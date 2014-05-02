var canvas = document.getElementById('c');
var ctx    = canvas.getContext('2d');

// Constants

var max_radius = 10;
var world_w = 800;
var world_h = 800;
var max_speed = 1.2;
var min_radius = 8;
var max_radius = 22;
var max_sight = 500;
var metabolism = 1 / 200;

// Genome functions

function truncExp(min,max,x,t) {
	if (x < 0) return min;
	return min + (max - min) * (1 - Math.exp(-x/t));
}

function speedF(x) {
	return truncExp(0,max_speed,x,1);
}

function radiusF(x) {
	return truncExp(min_radius,max_radius,x,10);
}

function digestionF(x) {
	return truncExp(0.01,0.9,x,1);
}

function sizeF(g) {
	var x = 1;
	for (var k in g) x *= 1 + g[k] * g[k];
	return x;
}

function photosynthF(x) {
	return x*x / 50;
}

function sightF(x) {
	return truncExp(0,max_sight,x,5);
}

function colorF(g) {
	var rgb = [0,0,0], i = 0;
	for (var k in g) rgb[i++ % 3] += g[k];
	var r = truncExp(0,255,rgb[0],3).toFixed();
	var g = truncExp(0,255,rgb[1],3).toFixed();
	var b = truncExp(0,255,rgb[2],3).toFixed();
	return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Creature class

function Creature(x,y,g) {

	this.x = x;
	this.y = y;
	this.g = g;
	this.dx = 0;
	this.dy = 0;
	this.odx = 0;
	this.ody = 0;
	
	this.speed = speedF(g.speed);
	
	this.energy = 1;
	this.size = sizeF(g);
	this.metabolism = this.size * metabolism - photosynthF(g.photosynth);
	this.digestion = digestionF(g.digestion);
	
	this.sight = sightF(g.sight);
	this.power = g.power + (this.sight * this.speed) / 100;
	
	this.r = radiusF(this.size);
	this.c = colorF(g);
	
	this.alive = true;
}

Creature.prototype = {

	render: function() {		
		ctx.beginPath();
		ctx.fillStyle = this.c;
		ctx.arc(this.x,this.y,this.r,0,6.2831);
		ctx.fill();
		ctx.beginPath();
		ctx.fillStyle = 'black';		
		ctx.arc(this.x,this.y,this.r-2,0,6.2831 * (1 - (this.energy / 2 / this.size)));
		ctx.lineTo(this.x,this.y);
		ctx.fill();	
	},
	
	// Performs movement actions, along with individual processing
	// (like metabolism)
	move : function() {
	
		var l = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
		
		if (l > 0) {
			this.odx = this.dx / l * this.speed;
			this.ody = this.dy / l * this.speed;
			this.dx = 0;
			this.dy = 0;				
		}
		this.x += this.odx;
		this.y += this.ody;	

		if (this.x > world_w) this.x = world_w;
		if (this.x < -world_w) this.x = -world_w;
		
		if (this.y > world_h) this.y = world_h;
		if (this.y < -world_h) this.y = -world_h;
		
		if ((this.energy -= this.metabolism) < 0) 
			this.alive = false;
	},
	
	// Create a copy of this creature, splitting in the 
	// direction of movement OR a random direction if fixed.
	// A total energy amount of 2*(this.size - 1) is lost upon 
	// reproduction.
	reproduce : function() {
	
		if (this.energy < 2 * this.size) return null;
		
		this.energy = 1;
	
		var dx = this.odx;
		var dy = this.ody;
		var  l = Math.sqrt(dx * dx + dy * dy);
		if (l == 0) {
			var a = Math.random() * 6.283;
			dx = Math.cos(a);
			dy = Math.sin(a);
			l = 1;
		}
		var r = 4.2 * this.r / l;
		
		var g = {};
		for (var k in this.g) {
			g[k] = this.g[k];
			if (Math.random() < 0.01) g[k] += Math.random() - 0.5;
		}
		
		return new Creature(this.x - dx * r, this.y - dy * r, g);		
	}

};

// A sorted array of all creatures, used for collision detection

function Universe(creatures) {
	this.creatures = creatures;
	this.followed = creatures[0];
}

Universe.prototype = {

	// Render all creatures, centered around the followed creature
	render: function() {
		
		var x = this.followed.x;
		var y = this.followed.y;
		var w = canvas.width / 2;
		var h = canvas.height / 2;

		// Erase everything
		ctx.clearRect(0,0,2*w,2*h);
		
		// Center on followed creature
		ctx.save();
		ctx.translate(w-x,h-y);
		
		var mx = x + w + max_radius;
		for (var i = this.find(x - w - max_radius); i < this.creatures.length; ++i) {		
			var c = this.creatures[i];
			if (c.x > mx) break;
			if (c.y + c.r < y - h) continue;
			if (c.y - c.r > y + h) continue;
			c.render();
		}
		
		// Restore translation status
		ctx.restore();
	},

	// Sort the array of creatures by their 'x' position.
	sort: function() {
		this.creatures.sort(function(a,b) { return a.x - b.x });
	},
	
	// Move every creature in the (dx,dy) direction at its current  
	// speed, reset the direction to zero and remember it. If no
	// direction, keep moving at same speed and direction as 
	// previously (to get unstuck).
	//
	// Also removes dead creatures
	move: function() {	
		var clean = [];	
		for (var i = 0; i < this.creatures.length; ++i) {
			var c = this.creatures[i];
			c.move();
			if (c.alive) clean.push(c);
		}
		this.creatures = clean;
		if (!this.followed.alive) this.followed = this.creatures[0];
	},
	
	// Returns i such that for any j < i, creature j is to the left
	// of position x.
	find: function(x) {
		
		var a = 0, b = this.creatures.length;
		
		while (a + 1 != b) {
			var m = (a + b) >> 1;
			if (this.creatures[m].x < x) a = m;
			else b = m; 			
		}
		
		return a;
	},
	
	// Give each creature a chance to reproduce. Add the spawned 
	// creature to the array.
	reproduce: function(x) {
	
		var spawned = [];
		for (var i = 0; i < this.creatures.length; ++i) {		
			var c = this.creatures[i].reproduce();
			if (c !== null) spawned.push(c);			
		}
		
		this.creatures.push.apply(this.creatures, spawned);
	},
	
	// Applies function 'f' to each creature that *touches* 
	// circle (x,y,r), except creature j 
	forEachInCircle: function(x,y,r,j,f) {		
	
		var mx = x + r + max_radius;
		for (var i = this.find(x - r - max_radius); i < this.creatures.length; ++i) {			
			
			if (i == j) continue;
			var c = this.creatures[i];
			
			if  (c.x > mx) break; 
			
			var dx = c.x - x;
			var dy = c.y - y;
			var d2 = dx * dx + dy * dy;
			var r_ = c.r + r;
			var r2 = r_ * r_;
			
			if (d2 <= r2) f(c);
			
		}
	},
	
	// Creatures look around, flee what they cannot fight, move
	// towards what they can fight
	view: function() {
	
		for (var i = 0; i < this.creatures.length; ++i) {
			
			var c = this.creatures[i];
			if (!c.alive) continue;
			if (c.sight == 0) continue;
			
			this.forEachInCircle(c.x,c.y,c.r + c.sight,i,function(c2){
				
				// Ignore the dead
				if (!c2.alive) return;
				
				var diff = c.power - c2.power - 0.01;
				var dx = c2.x - c.x;
				var dy = c2.y - c.y;
				
				var lsq = dx * dx + dy * dy; 
				if (lsq == 0) return;
				
				// Move towards closest, weakest neighbor.
				c.dx += dx * diff / lsq;
				c.dy += dy * diff / lsq;
				
			});
		}
		
	},
	
	// Creatures that touch each other fight, the winner eats the 
	// loser.
	fight: function() {
	
		for (var i = 0; i < this.creatures.length; ++i) {
			
			var c = this.creatures[i];
			if (!c.alive) continue;
			
			this.forEachInCircle(c.x,c.y,c.r,i,function(c2){
				
				// First killer takes all
				if (!c2.alive) return;
				
				// Will happen on the way around
				if (c.power < c2.power) return;
				
				c2.alive = false;
				c.energy += c2.energy * c.digestion;
				
			});
		}
		
	}

};

// Processing loop 

function loop(universe) {

	universe.sort();
	universe.render();
	universe.fight();
	universe.view();
	universe.move();
	universe.reproduce();
	
	setTimeout(function() { loop(universe); }, 50);
}

// Initial setup 

var genome = {
	speed: 0,
	photosynth: 1,
	digestion: 0,
	power: 0,
	sight: 0
};

var creatures = [
	new Creature(0,0,genome)
];

loop(new Universe(creatures));
