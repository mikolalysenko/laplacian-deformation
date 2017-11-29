const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
var control = require('control-panel')
//var bunny = require('bunny')
//var bunny = require('../mytext')
//var bunny = require('stanford-dragon/3')
var bunny = require('../bumps_dec.js')

const fit = require('canvas-fit')
var cameraPosFromViewMatrix   = require('gl-camera-pos-from-view-matrix');
var prepareDeform = require('../index')

var aabb = {
  min: [+1000, +1000, +1000],
  max: [-1000, -1000, -1000],
}

/*
  Find AABB for mesh.
*/
for(var j = 0; j < bunny.positions.length; ++j) {
  var p = bunny.positions[j]

  for(var i = 0; i < 3; ++i) {
    if(p[i] < aabb.min[i]) {
      aabb.min[i] = p[i]
    }
    if(p[i] > aabb.max[i]) {
      aabb.max[i] = p[i]
    }
  }
}

// find longest side of AABB.
var il = 0
for(var i = 1; i < 3; ++i) {
  if( (aabb.max[i]-aabb.min[i]) > aabb.max[il]-aabb.min[il]) {
    il = i
  }
}

/*
  Now that we have the AABB, we can use that info to the center the mesh,
  and scale it so that it fits in the unit cube.

  We do all those things for the purpose of normalizing the mesh, so
  that it is fully visible to the camera.
*/
var s = 1.0 / (aabb.max[il]-aabb.min[il])
var t = [
    -0.5 * (aabb.min[0] + aabb.max[0]),
    -0.5 * (aabb.min[1] + aabb.max[1]),
    -0.5 * (aabb.min[2] + aabb.max[2]),
]

for(var j = 0; j < bunny.positions.length; ++j) {

  var p = bunny.positions[j]

  p[0] += t[0]
  p[1] += t[1]
  p[2] += t[2]

  p[0] *= s
  p[1] *= s
  p[2] *= s
}

console.log("STUFF1")

var cs = []
var unconstrained = []
var stationary = []
var handles = []

// get the _unique_ vertex indices of the cells.
function getPoints(cells) {
  var set = {}
  for(var i = 0; i < cells.length; ++i) {
    var c = cells[i]

    set[c[0]] = true
    set[c[1]] = true
    set[c[2]] = true
  }
  var ps = []
  for(var k in set) {
    ps.push(parseInt(k))
  }
  return [ps, set]
}

for(var i = 0; i < bunny.cells.length; ++i) {
  var c = bunny.cells[i]
  var outside = false

  for(var j = 0; j < 3; ++j) {
    var p = bunny.positions[c[j+0]]

    if((p[2]+0.039) < 0.5) {
      outside = true
    }
  }

  if(!outside) {
    cs.push(c)
  }
}

var ret = getPoints(cs)
stationary = ret[0]
var stationarySet = ret[1]

cs = []
for(var i = 0; i < bunny.cells.length; ++i) {
  var c = bunny.cells[i]
  var outside = false

  for(var j = 0; j < 3; ++j) {
    var p = bunny.positions[c[j+0]]
    if((p[2]+0.039) > -0.42) {
      outside = true
    }
  }

  if(!outside) {
    cs.push(c)
  }
}
var ret = getPoints(cs)
handles = ret[0]
var handlesSet = ret[1]

console.log("STUFF2")

for(var i = 0; i < bunny.positions.length; ++i) {
  if(!(stationarySet[i] === true || handlesSet[i] === true)) {
    unconstrained.push(i)
  }
}

// copy of the mesh, that we use when restoring the mesh.
var copyBunny = JSON.parse(JSON.stringify(bunny))

var adj = []
for(var i = 0; i < bunny.positions.length; ++i) {
  adj[i] = []
}

for(var i = 0; i < bunny.cells.length; ++i) {
  var c = bunny.cells[i]
  for(var j = 0; j < 3; ++j) {
    var a = c[j+0]
    var b = c[(j+1) % 3]
    adj[a].push(b)
  }
}


var newHandlesObj = {
  handles: []
}

for(var i = 0; i < handles.length; ++i) {
  newHandlesObj.handles.push(handles[i])
}
newHandlesObj.unconstrainedBegin = newHandlesObj.handles.length

for(var i = 0; i < unconstrained.length; ++i) {
  newHandlesObj.handles.push(unconstrained[i])
}
newHandlesObj.stationaryBegin = newHandlesObj.handles.length

console.log("STUFF3")

for(var i = 0; i < stationary.length; ++i) {
  newHandlesObj.handles.push(stationary[i])
}

//console.log(bunny.cells)
var bc = ""
for(var i = 0; i < bunny.cells.length; ++i) {
  var c = bunny.cells[i]
  bc += c[0] + " " + c[1] + " " + c[2] + "\n"
}
//console.log(bc)

var bp = ""
for(var i = 0; i < bunny.positions.length; ++i) {
  var p = bunny.positions[i]
  bp += p[0] + " " + p[1] + " " + p[2] + "\n"
}
//console.log(bp)

var h = ""
for(var i = 0; i < newHandlesObj.handles.length; ++i) {

  h += newHandlesObj.handles[i] + "\n"
}
//console.log(h)
console.log("newHandlesObj.unconstrainedBegin: ", newHandlesObj.unconstrainedBegin)
console.log("newHandlesObj.stationaryBegin: ", newHandlesObj.stationaryBegin)



// input we export to C++.
//newHandlesObj.doDeform = prepareDeform(bunny.cells, bunny.positions, newHandlesObj)

var fs = require('fs');

fs.writeFile("./bc.txt", bc, function(err) {});

fs.writeFile("./bp.txt", bp, function(err) {});

fs.writeFile("./h.txt", h, function(err) {});
