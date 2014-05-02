var canvas = document.getElementById('c');
var ctx    = canvas.getContext('2d');

// Constants

var max_radius = 10;
var world_w = 800;
var world_h = 800;

// Creature class

function Creature(x,y) {
	this.x = x;
	this.y = y;
	this.dx = Math.random() * 5 - 2.5;
	this.dy = Math.random() * 5 - 2.5;
	this.speed = 1 + Math.random() * 5;
	this.odx = 0;
	this.ody = 0;
	this.r = 4 + Math.random() * 12;
	this.c = 'rgb(' + (Math.random() * 256).toFixed() + ',' + (Math.random() * 256).toFixed() + ',' + (Math.random() * 256).toFixed() + ')';
}

Creature.prototype = {

	render: function() {		
		ctx.beginPath();
		ctx.fillStyle = this.c;
		ctx.arc(this.x,this.y,this.r,0,6.2831);
		ctx.fill();
	},
	
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
		
	},
	
	// Create a copy of this creature, splitting in the 
	// direction of movement OR a random direction if fixed
	reproduce : function() {
	
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
		
		var c = new Creature(this.x, this.y);
		
		c.x -= dx * r;
		c.y -= dy * r;
		
		return c;
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
	move: function() {
		for (var i = 0; i < this.creatures.length; ++i) {
			var c = this.creatures[i].move();
		}
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
			if (Math.random() > 0.05) continue;
			spawned.push(this.creatures[i].reproduce());			
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
	}

};

// Processing loop 

function loop(universe) {

	universe.sort();
	universe.render();
	universe.move();
	universe.reproduce();
	
	setTimeout(function() { loop(universe); }, 50);
}

// Initial setup 

var creatures = [
	new Creature(0,0)
];

loop(new Universe(creatures));
