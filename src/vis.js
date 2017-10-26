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

var cs = []
var unconstrained = []
var stationary = []
var handles = []

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

// make an object that can be used to deform a section of the mesh.
// The function will deform the vertex with index mainHandle, and
// vertices that are close enough it.
function makeHandlesObj(mainHandle) {

  var newHandlesObj = {
    handles: []
  }

  var visited = []
  for(var i = 0; i < bunny.positions.length; ++i) {
    visited[i] = false
  }

  var currentRing = [mainHandle]

  while(newHandlesObj.handles.length < 10) {

    var nextRing = []

    for(var i = 0; i < currentRing.length; ++i) {
      var e = currentRing[i]

      if(visited[e])
        continue

      newHandlesObj.handles.push(e)
      visited[e] = true

      var adjs = adj[e]

      for(var j = 0; j < adjs.length; ++j) {
        nextRing.push(adjs[j])
      }
    }
    currentRing = nextRing
  }
  newHandlesObj.afterHandles = newHandlesObj.handles.length


  // 800
  while(newHandlesObj.handles.length < 100) {

    var nextRing = []

    for(var i = 0; i < currentRing.length; ++i) {
      var e = currentRing[i]

      if(visited[e])
        continue

      newHandlesObj.handles.push(e)
      visited[e] = true

      var adjs = adj[e]
      for(var j = 0; j < adjs.length; ++j) {
        nextRing.push(adjs[j])
      }
    }
    currentRing = nextRing
  }

  newHandlesObj.afterHandlesMore = newHandlesObj.handles.length

  var staticVertices = []
  for(var i = 0; i < currentRing.length; ++i) {
    var e = currentRing[i]

    if(visited[e])
      continue

    staticVertices.push(e)
    newHandlesObj.handles.push(e)

    visited[e] = true
  }

  // // verify that it is an actual loop.
  // while(sv.length > 0) {
  //   var breakOuter = false
  //   var adjs = adj[e]
  //   for(var i = 0; i < adjs.length; ++i) {

  //     var p = adjs[i]

  //     for(var j = 0; j < sv.length; ++j) {
  //       if(p === sv[j]) {
  //         breakOuter = true
  //         sortedOrder.push(sv[j])
  //         e = sv[j]
  //         sv.splice(j, 1)
  //         break
  //       }
  //     }

  //     if(breakOuter)
  //       break
  //   }

  //   if(!breakOuter) {
  //     console.log("IS NOT PROPER LOOP)
  //      break
  //   }

  // conse.log("sorred order: ", sortedOrder)

  newHandlesObj.mainHandle = mainHandle
  newHandlesObj.doDeform = prepareDeform(bunny.cells, bunny.positions, newHandlesObj)

  return newHandlesObj

}

var newHandlesObj = {
  handles: []
}

for(var i = 0; i < handles.length; ++i) {
  newHandlesObj.handles.push(handles[i])
}
newHandlesObj.afterHandles = newHandlesObj.handles.length

for(var i = 0; i < unconstrained.length; ++i) {
  newHandlesObj.handles.push(unconstrained[i])
}
newHandlesObj.afterHandlesMore = newHandlesObj.handles.length

for(var i = 0; i < stationary.length; ++i) {
  newHandlesObj.handles.push(stationary[i])
}

newHandlesObj.mainHandle = handles[0]
newHandlesObj.doDeform = prepareDeform(bunny.cells, bunny.positions, newHandlesObj)

// set current handle that we're manipulating.
var handlesObj = newHandlesObj
const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')({canvas: canvas})

var str = `<a href="https://github.com/mikolalysenko/laplacian-deformation"><img style="position: absolute; top: 0; left: 0; border: 0;" src="https://camo.githubusercontent.com/82b228a3648bf44fc1163ef44c62fcc60081495e/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f6c6566745f7265645f6161303030302e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_left_red_aa0000.png"></a>`


    /*
      Create GUI

    */
var container = document.createElement('div')
container.innerHTML = str
document.body.appendChild(container)

var renderHandles = true
var panel = control([
  {type: 'checkbox', label: 'render_handles', initial: renderHandles},
  {type: 'button', label: 'Reset Mesh', action: function () {
    bunny = JSON.parse(JSON.stringify(copyBunny))
    var handlesObj = newHandlesObj
    doDeform([+0.0, 0.0, 0.0])
    positionBuffer.subdata(bunny.positions)
  }},
],
                    {theme: 'light', position: 'top-right'}
                   ).on('input', data => {
                     renderHandles = data.render_handles
                     params = data
                   })

var par = document.createElement("h3")
par.innerHTML = "Click near the handles and drag to deform the mesh. <br>Hold \"Q\"-key, and drag the mouse, and/or scroll to change the view."

var div = document.createElement('div')
div.style.cssText = 'color: #000; position: absolute; bottom: 0px; width: 100%; padding: 5px; z-index:100;'
div.style.fontSize = '10px'
div.appendChild(par)
document.body.appendChild(div)

/*
  Create command for drawing bunny.
*/
const positionBuffer = regl.buffer({
  length: bunny.positions.length * 3 * 4,
  type: 'float',
  usage: 'dynamic'
})

var bunnyNormals = normals(bunny.cells, bunny.positions)
var bunnyColors = []

for(var i = 0; i < bunnyNormals.length; ++i) {
  if(stationarySet[i] === true) {
    bunnyColors[i] = [0.4, 0.4, 0.4];
  } else if(handlesSet[i] === true) {
    bunnyColors[i] = [0.8, 0.8, 0.0];
  } else {
    bunnyColors[i] = [0.0, 0.0, 0.7];
  }
}

var drawBunny = regl({
  vert: `
  precision mediump float;
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec3 color;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vPosition;

  uniform mat4 view, projection;
  void main() {
    vNormal = normal;
    vPosition = position;
    vColor = color;

    gl_Position = projection * view * vec4(position, 1);
  }`,

  frag: `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vColor;

  uniform vec3 uEyePos;

  void main() {

    vec3 color = vColor;

    vec3 lp = uEyePos;

    vec3 l = normalize(lp - vPosition);
    vec3 v = normalize(uEyePos - vPosition);

    vec3 lc = vec3(1.0);

    gl_FragColor = vec4(

      0.5*color +
        0.35*lc*clamp( dot(vNormal, l), 0.0,1.0 )
        +                          0.15*lc*pow(clamp(dot(normalize(l+v),vNormal),0.0,1.0)  , 8.0)

      , 1.0);

  }`,

  attributes: {
    position: {
      buffer: positionBuffer,
      normalized: true
    },

    normal: bunnyNormals,
    color: bunnyColors,

  },

  elements: bunny.cells,
  primitive: 'triangles'
})

function doDeform(offset) {

  var numHandles = handlesObj.afterHandles - 0
  var numStationary = handlesObj.handles.length - handlesObj.afterHandlesMore

  if(!handlesObj)
    return

  var arr = []
  for(var i = 0; i < (numHandles + numStationary); ++i) {
    arr[i] = []
  }

  var j = 0
  for(var i = 0; i < (handlesObj.afterHandles); ++i) {
    arr[j][0] = bunny.positions[handlesObj.handles[i]][0]  + offset[0]
    arr[j][1] = bunny.positions[handlesObj.handles[i]][1]  + offset[1]
    arr[j][2] = bunny.positions[handlesObj.handles[i]][2]  + offset[2]

    ++j
  }

  for(var i = handlesObj.afterHandlesMore; i < (handlesObj.handles.length); ++i) {
    arr[j][0] = bunny.positions[handlesObj.handles[i]][0]
    arr[j][1] = bunny.positions[handlesObj.handles[i]][1]
    arr[j][2] = bunny.positions[handlesObj.handles[i]][2]

    ++j
  }
  // deform.
  var d = handlesObj.doDeform(arr, bunny.positions)


  positionBuffer.subdata(bunny.positions)
}
//doDeform([+0.0, +0.0, 0.0])
positionBuffer.subdata(bunny.positions)

const camera = require('canvas-orbit-camera')(canvas)
window.addEventListener('resize', fit(canvas), false)
camera.rotate([0.0, 0.0], [0.0, -0.4])
camera.rotate([0.0, 0.0], [0.7, 0.0])

camera.zoom(-29.0)
var mp = require('mouse-position')(canvas)
var projectionMatrix = mat4.perspective([],
                                        Math.PI / 4,
                                        canvas.width / canvas.height,
                                        0.01,
                                        1000)

const globalScope = regl({
  uniforms: {
    view: () => {
      return camera.view()
    },
    projection: () => projectionMatrix,

    uEyePos: () =>{
      return cameraPosFromViewMatrix([], camera.view())
    }

  }
})

function screenspaceMousePos() {
  return [2.0 * mp[0] / canvas.width - 1.0, -2.0 * mp[1] / canvas.height + 1.0]
}

// get ray starting from camera position, heading in the viewing direction of the camera.
function getCameraRay() {
  var mousePos = screenspaceMousePos()

  var view = camera.view()
  var vp = []
  mat4.multiply(vp, projectionMatrix, view)

  var inverseVp = []
  mat4.invert(inverseVp, vp)

  var v = []
  vec3.transformMat4(v, [mousePos[0], mousePos[1], 0], inverseVp)

  var camPos = cameraPosFromViewMatrix([], view)

  var d = [v[0] - camPos[0], v[1] - camPos[1], v[2] - camPos[2]]
  var o = [camPos[0], camPos[1], camPos[2]]

  vec3.normalize(d, d)

  return [d, o] // ray direction, ray origin.
}

var isDragging = false

// draws a handle as a sphere.
const drawHandle = regl({
  vert: `
  precision mediump float;
  attribute vec3 position;
  uniform mat4 view, projection;
  uniform vec3 pos;

  void main() {
    gl_Position = projection * view * vec4(position*0.010 + pos, 1);
  }`,

  frag: `
  precision mediump float;

  uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, 1.0);
  }`,

  attributes: {
    position: () => sphereMesh.positions,
  },

  elements: () => sphereMesh.cells,

  uniforms: {
    color: (_, props) => {
      return props.color
    },
    pos: (_, props) => {
      return props.pos
    }
  }
})

var movecamera = false

window.onkeydown = function(e) {
  var key = e.keyCode ? e.keyCode : e.which;

  if (key == 81) {
    movecamera = true
    isDragging = false
  }
  if (key == 87) {
    var out = []
    camera.view(out)
    console.log(out)
  }
}

window.onkeyup = function(e) {
  var key = e.keyCode ? e.keyCode : e.which;

  if (key == 81) {
    movecamera = false
  }
}

var prevPos = null
var prevMousePos = null
canvas.addEventListener('mousedown', mousedown, false)

/*
  When clicking mouse, pick handle that is near enough to mouse, and closest to the camera.
*/
function mousedown() {
  if(!movecamera) {

  }
}

canvas.addEventListener('mouseup', mouseup, false)
function mouseup() {
  var mousePos = screenspaceMousePos()

  isDragging = false
}

camera.tick()

regl.frame(({viewportWidth, viewportHeight}) => {
  regl.clear({
    depth: 1,
    color: [1, 1, 1, 1]
  })

  globalScope( () => {
    drawBunny()

    if(handlesObj != null) {
      for(var i = 0; i < handlesObj.handles.length; ++i) {
        //      if(i != 3) continue
        var handle = bunny.positions[handlesObj.handles[i]]

        var c = [0.5, 0.5, 0.5]

        if(i >= handlesObj.afterHandlesMore) {
          c = [1.0, 0.0, 0.0]
        } else if(i >= handlesObj.afterHandles){
          c = [0.0, 1.0, 0.0]
        } else {
          c = [0.0, 0.0, 1.0]
        }
      }
    }
  })

  // if the mouse is moved while left mouse-button is down,
  // the main handle should follow the mouse.
  // the below calculations ensure this.
  if(isDragging) {
    var ret = getCameraRay()
    var d = ret[0]
    var o = ret[1]

    var mousePos = screenspaceMousePos()

    // plane point, and normal.
    var pr0 = bunny.positions[handlesObj.handles[0]]
    var pn = [o[0] - pr0[0], o[1] - pr0[1], o[2] - pr0[2]]

    vec3.normalize(pn, pn)

    var t = (vec3.dot(pn, pr0) - vec3.dot(pn, o)) / vec3.dot(d, pn)

    var p = vec3.add([], o, vec3.scale([], d, t))

    if(prevPos != null && prevMousePos != null) {

      var diff = vec3.subtract([],
                               [mousePos[0], mousePos[1], 0],
                               [prevMousePos[0], prevMousePos[1], 0])
      if(vec3.length(diff) < 0.001) {

      } else {

        var def = vec3.subtract([], p, prevPos)

        doDeform(def)
      }

    }
    prevPos = p
    prevMousePos = mousePos
  }


  if(movecamera) {
    camera.tick()
  }
})
