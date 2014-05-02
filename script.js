var canvas = document.getElementById('c');
var ctx    = canvas.getContext('2d');

// Constants

var max_radius = 10;

// Creature class

function Creature(x,y) {
	this.x = x;
	this.y = y;
	this.r = 10;
	this.c = 'red';
}

Creature.prototype = {

	render: function() {		
		ctx.fillStyle = this.c;
		ctx.arc(this.x,this.y,this.r,0,6.2831);
		ctx.fill();
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

		// Center on followed creature
		ctx.translate(w-x,h-y);
		
		// Erase everything
		ctx.fillStyle = 'white';
		ctx.fillRect(-w,-h,2*w,2*h);
		
		var mx = x + w + max_radius;
		for (var i = this.find(x - w - max_radius); i < this.creatures.length; ++i) {		
			var c = this.creatures[i];
			if (c.x > mx) break;
			if (c.y + c.r < y - h) continue;
			if (c.y - c.r > y + h) continue;
			c.render();
		}
		
		// Restore translation status
		ctx.translate(x-w,y-w);
	},

	// Sort the array of creatures by their 'x' position.
	sort: function() {
		this.creatures.sort(function(a,b) { return a.x - b.x });
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
	
	setTimeout(function() { loop(universe); }, 50);
}

// Initial setup 

var creatures = [
	new Creature(3,16)
];

loop(new Universe(creatures));
