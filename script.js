var canvas = document.getElementById('c');
var ctx    = canvas.getContext('2d');
var info   = document.getElementById('info');

// Constants

var max_radius = 3;//10
var world_w = 800;//800
var world_h = 800;//800
var max_speed = 3.2;//1.2
var min_radius = 1;//3
var max_radius = 3;//50
var max_sight = 500;//500
var metabolism = 1 / 2500;// 1/200
var intake = 0.15;// 0.015

// Genome functions

function truncExp(min,max,x,t) {
	if (x < 0) return min;
	return min + (max - min) * (1 - Math.exp(-x/t));
}

function truncExpDual(min,max,x,t) {
	var mid = (max + min) / 2; 
	if (x < 0) return mid + (min - mid) * (1 - Math.exp(x/t));
	return mid + (max - mid) * (1 - Math.exp(-x/t));
}

function speedF(x) {
	return truncExp(0,max_speed,x,1);
}

function radiusF(x) {
	return truncExpDual(min_radius,max_radius,x,2);
}

function digestionF(x) {
	return truncExp(0.1,1,x,1);
}

function sizeF(g) {
	var x = 0.8;
	for (var k in g) 
		if (g[k] > 0) 
			x += 0.5 + g[k] * g[k];
	return x * x;
}

function photosynthF(x) {
	return x * x / 25;
}

function sightF(x) {
	return truncExp(0,max_sight,x,5);
}

function fightF(x) {
	if (x < 0) return 0;
	return truncExp(0,2,x*x,5);
}

function colorF(g) {
	var rgb = [0.01,0.01,0.01], i = 0;
	for (var k in g) rgb[i++ % 3] += Math.max(0,g[k]);
	var max = Math.max(rgb[0],Math.max(rgb[1],rgb[2]));
	var sum = truncExp(128,255,rgb[0] + rgb[1] + rgb[2],2);
	var r = (sum * rgb[0]/max).toFixed();
	var g = (sum * rgb[1]/max).toFixed();
	var b = (sum * rgb[2]/max).toFixed();
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
	
	this.size = sizeF(g);
	this.cost  = this.size * this.size;
	this.metabolism = this.size * metabolism - photosynthF(g.photosynth) - intake;
	this.digestion = digestionF(g.digestion);
	
	this.sight = sightF(g.sight);
	this.power = fightF(g.power);
	this.armor = fightF(3*g.armor);
	
	this.r = radiusF(this.size - g.mini - 4);
	this.c = colorF(g);
	
	this.energy = this.cost;
	
	this.penetrate = false;
	
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
		ctx.arc(this.x,this.y,this.r-2,0,6.2831 * (1 - (this.energy / 2 / this.cost)));
		ctx.lineTo(this.x,this.y);
		ctx.fill();	
	},
	
	renderInfo: function() {
	
		var html = [];
		function add(k,o) { html.push('<dt>',k,'</dt><dd>',o[k].toFixed(2),'</dd>'); }
		
		for (var k in this.g) add(k,this.g);
		add("energy",this);
		add("speed",this);
		add("size",this);
		add("metabolism",this);
		add("sight",this);
		add("digestion",this);
		add("power",this);
		add("armor",this);
		
		info.innerHTML = html.join('');
	},
	
	// Performs movement actions, along with individual processing
	// (like metabolism)
	move : function() {
	
		var l = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
		var speed = this.penetrate ? max_speed : this.speed;
		
		if (l > 0) {
			this.odx = this.dx / l * speed;
			this.ody = this.dy / l * speed;
			this.dx = 0;
			this.dy = 0;				
		}
		
		if (speed > 0) {
			this.x += this.odx;
			this.y += this.ody;	
		}
		
		if (this.x > world_w) this.x = world_w;
		if (this.x < -world_w) this.x = -world_w;
		
		if (this.y > world_h) this.y = world_h;
		if (this.y < -world_h) this.y = -world_h;
		
		if ((this.energy -= this.metabolism) < 0) 
			this.alive = false;
			
		this.penetrate = false;
	},
	
	// Create a copy of this creature, splitting in the 
	// direction of movement OR a random direction if fixed.
	reproduce : function() {
	
		if (this.energy < 2 * this.cost) return null;
		
		this.energy -= this.cost;

		var a = Math.random() * 6.283;
		dx = Math.cos(a);
		dy = Math.sin(a);
		var r = min_radius;
		
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
	
		this.followed.renderInfo();
		
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
		if (!this.followed.alive) 
			this.followed = this.creatures[Math.floor(this.creatures.length/2)];
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
				
				c.penetrate = true;

				var steal = c.power - c2.armor;
				if (c.power > c2.power && steal > 0) 
				{
					feeding = true;
					
					if (steal > c2.energy) {
						steal = c2.energy;
						c2.alive = false;
					}
					
					c2.energy -= steal;
					c.energy  += steal * c.digestion;
				}
				else
				{
					c.energy -= 0.05;
				}
				
			});
		}
		
	},
	
	click: function(x,y) {
		x += this.followed.x - canvas.width/2 - canvas.offsetLeft;
		y += this.followed.y - canvas.height/2 - canvas.offsetTop;
		for (var i = this.find(x-max_radius); i < this.creatures.length; ++i) {
			var c = this.creatures[i];
			if (c.x - max_radius > x) return;
			var dx = c.x - x;
			var dy = c.y - y;
			if (c.r * c.r > dx * dx + dy * dy) {
				this.followed = c;
				return;
			}
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
	photosynth: 0,
	digestion: 0,
	power: 0,
	mini: 0,
	armor: 0,
	sight: 0
};

var creatures = [
	new Creature(0,0,genome),
	new Creature(50,5,genome)
];

var universe = new Universe(creatures);

loop(universe);

canvas.onclick = function(ev) {
	universe.click(ev.clientX,ev.clientY);
}
