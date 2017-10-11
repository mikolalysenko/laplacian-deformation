const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
var control = require('control-panel')
//var bunny = require('bunny')
var bunny = require('../mytext')

//bumps_dec.js

var bunny = require('../bumps_dec.js')
//var bunny = require('stanford-dragon/3')
/*
for(var j = 0; j < bunny.positions.length; ++j) {
  if(bunny.positions[j][0] < -45.0) {
    console.log("index: ", j)
  } else {
    bunny.positions[j] = [-100.0, 0.0, 0.0]
  }
}
*/


const fit = require('canvas-fit')
var ch = require('conway-hart')
var cameraPosFromViewMatrix   = require('gl-camera-pos-from-view-matrix');
var sphereMesh = require('primitive-sphere')(1.0, { segments: 16 })
var prepareDeform = require('../index')

//var vectorizeText = require("vectorize-text")

function revisedONB(n, b1, b2) {
  var b1 = [0.0, 0.0, 0.0]
  var b2 = [0.0, 0.0, 0.0]

  if (n[2] < 0.0) {
    const a = 1.0 / (1.0 - n[2]);
    const b = n[0] * n[1] * a;
    b1 = [1.0 - n[0] * n[0] * a, -b, n[0]];
    b2 = [b, n[1] * n[1] * a - 1.0, -n[1]];
    return [b1, b2]
  } else {
    const a = 1.0 / (1.0 + n[2]);
    const b = -n[0] * n[1] * a;
    b1 = [1.0 - n[0] * n[0] * a, b, -n[0]];
    b2 = [b, 1.0 - n[1] * n[1] * a, -n[1]];
    return [b1, b2]
  }
}

/*
function fixCenteredText(str) {
  var complex =  vectorizeText(str, {
    triangles: true,
    width: 0.02,
    textBaseline: "hanging"
  })

  var aabb = {
    min: [+1000, +1000],
    max: [-1000, -1000],
  }


  for(var j = 0; j < complex.positions.length; ++j) {
    var p = complex.positions[j]

    for(var i = 0; i < 2; ++i) {
      if(p[i] < aabb.min[i]) {
        aabb.min[i] = p[i]
      }
      if(p[i] > aabb.max[i]) {
        aabb.max[i] = p[i]
      }
    }
  }

  var t = [
      -0.5 * (aabb.min[0] + aabb.max[0]),
      -0.5 * (aabb.min[1] + aabb.max[1])]


  for(var j = 0; j < complex.positions.length; ++j) {

    var p = complex.positions[j]

    p[0] += t[0]
    p[1] += t[1]

    p[1] *= -1.0
  }

  return complex

}
*/


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

var tx = bunny.positions[1081][0]
var ty = bunny.positions[1081][1]
var tz = bunny.positions[1081][2]


for(var j = 0; j < bunny.positions.length; ++j) {

  var p = bunny.positions[j]

  p[0] -= tx
  p[1] -= ty
  p[2] -= tz
}

//1081

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


    if(p[2] < 0.5) {
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
    if(p[2] > -0.42) {
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

console.log("stationary ", stationary)
console.log("handles ", handles)
console.log("unconstrained ", unconstrained)
console.log("unconstrained ", bunny.positions.length)


// copy of the mesh, that we use when restoring the mesh.
var copyBunny = JSON.parse(JSON.stringify(bunny))

function dist(u, v) {
  var dx = u[0] - v[0]
  var dy = u[1] - v[1]
  var dz = u[2] - v[2]

  return Math.sqrt(dx*dx + dy*dy + dz*dz)
}

var adj = []
for(var i = 0; i < bunny.positions.length; ++i) {
  adj[i] = []
}

for(var i = 0; i < bunny.cells.length; ++i) {
  var c = bunny.cells[i]
//  console.log("i: ", i)
  for(var j = 0; j < 3; ++j) {
    var a = c[j+0]
    var b = c[(j+1) % 3]

/*    if(adj[a] === "undefined") {
      console.log("BAAAAD")
    }

    if(i >= 5352) {
      console.log("j: ", a)
    }

    if(a > bunny.cells.length || a < 0) {
      console.log("BAAAAD")
    }
*/
    adj[a].push(b)
  }
}




var bunnyLines2 = []

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
  //  newHandlesObj.handles.push(mainHandle)
  //  console.log("console: ", adj[mainHandle])

  console.log("mainHandle: ", mainHandle)

  // 60
  while(newHandlesObj.handles.length < 10) {

    var nextRing = []

    for(var i = 0; i < currentRing.length; ++i) {
      var e = currentRing[i]

      if(visited[e])
        continue

      newHandlesObj.handles.push(e)
      visited[e] = true

      var adjs = adj[e]

      console.log("adjs: ", e, adjs)

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

    // var fc = []
    // for(var i = 0; i < bunny.positions.length; ++i) {
    // fc[i] = 0
    // }


    // //        newHandlesObj.handles.push(e)
    // for(var i = 0; i < newHandlesObj.handles.length; ++i) {
    // var e = newHandlesObj.handles[i]
    // fc[e]++
    // if(fc > 1) {
    // console.log("THIS IS BAD")
    // }
    // }






  var staticVertices = []
  console.log("currentRing: ", currentRing)
  for(var i = 0; i < currentRing.length; ++i) {
    var e = currentRing[i]

    if(visited[e])
      continue

    staticVertices.push(e)
    newHandlesObj.handles.push(e)

    visited[e] = true
  }


  // console.log("staticVertices: ", staticVertices)

  // var sv = JSON.parse(JSON.stringify(staticVertices))

  // sv = [577, 424, 1243, 103, 586, 625, 732, 532, 207, 1638, 1081]

  // console.log("static vertices: ", sv)
  // var sortedOrder = []
  // var e = sv.shift()
  // sortedOrder.push(e)

  var bunnyLines =  require("gl-wireframe")(bunny.cells)
  for(var i = 0; i < bunnyLines.length; i+=2) {
    var f = [bunnyLines[i+0], bunnyLines[i+1]]
    if(f[0] == e || f[1] == e) {
      //      console.log("LIST: ", f)
      bunnyLines2.push(f)
    }
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
  console.log("handles: ", newHandlesObj.handles)

  return newHandlesObj

}

function createParagraph (elem, text) {
  var par = document.createElement(elem)
  par.innerHTML = text

  var div = document.createElement('div')
  div.style.cssText = 'margin: 0 auto; max-width: 760px;'
  div.style.fontSize = '30px'
  div.style.fontFamily = 'verdana'
  div.style.color = '#444444'
  div.appendChild(par)
  document.body.appendChild(div)

  return par
}

var handlesObjArr = []

var workItems = [
  40,
  // 675,
  // 850, 975, 156, 1523
]
var iWork = 0

// loading string.
var par = createParagraph('h3', '')

function updateProgress(i) {
  par.innerHTML = "LOADING DEMO<br>Preparing handle " + i + "/" + workItems.length
}

function loop () {

  //  handlesObjArr.push(makeHandlesObj(workItems[iWork]))
  ++iWork
  updateProgress(iWork)

  if(iWork < workItems.length) {
    setTimeout(loop, 0)

  } else {
    // clear text.
    par.innerHTML = ""

    // loading done, now do the rest.
    executeRest()
  }
}

updateProgress(0)
// use timeout to do loading, so that the loading string is properly updated.
setTimeout(loop, 0)

function executeRest() {

  console.log("DONE LOADING")
//  handlesObjArr.push(makeHandlesObj(675))
  //handlesObjArr.push(makeHandlesObj(17000)) // 639, 1625, 1263(good)

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

    console.log("newHandlesObj.handles: ", newHandlesObj.handles)

  for(var i= 0; i < newHandlesObj.afterHandles; ++i) {
    if(bunny.positions[newHandlesObj.handles[i]][2] > -0.42) {
      console.log("WWWWRRRONG")
    }
  }

  for(var i= newHandlesObj.afterHandlesMore; i < newHandlesObj.handles.length; ++i) {
    if(bunny.positions[newHandlesObj.handles[i]][2] < 0.5) {
    console.log("WWWWRRRONG: ", bunny.positions[newHandlesObj.handles[i]])
    }
  }





  newHandlesObj.mainHandle = handles[0]
  console.log("start deform3")
  console.log("start deform3: ", newHandlesObj.handles.length)


  newHandlesObj.doDeform = prepareDeform(bunny.cells, bunny.positions, newHandlesObj)

  handlesObjArr.push(newHandlesObj)

  // set current handle that we're manipulating.
  var handlesObj = handlesObjArr[0]
  const canvas = document.body.appendChild(document.createElement('canvas'))
  const regl = require('regl')({canvas: canvas})
  console.log("step-1")

  var str = `<a href="https://github.com/mikolalysenko/laplacian-deformation"><img style="position: absolute; top: 0; left: 0; border: 0;" src="https://camo.githubusercontent.com/82b228a3648bf44fc1163ef44c62fcc60081495e/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f6c6566745f7265645f6161303030302e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_left_red_aa0000.png"></a>`


      /*
        Create GUI

      */

  var container = document.createElement('div')
  container.innerHTML = str
  document.body.appendChild(container)

  console.log("step0")

  var renderHandles = true
  var panel = control([
    {type: 'checkbox', label: 'render_handles', initial: renderHandles},
    {type: 'button', label: 'Reset Mesh', action: function () {
      bunny = JSON.parse(JSON.stringify(copyBunny))
      var handlesObj = handlesObjArr[0]
     //doDeform([+0.0, +1.0, 0.0])
//      bunny.positions[0][0] += 1000.0

  positionBuffer.subdata(bunny.positions)
      console.log("RESET MESH")
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


  console.log("step1")
  /*
    Create command for drawing bunny.
  */
  const positionBuffer = regl.buffer({
    length: bunny.positions.length * 3 * 4,
    type: 'float',
    usage: 'dynamic'
  })

  var bunnyNormals = normals(bunny.cells, bunny.positions)

  var newCells = []
/*  console.log("about to run loop: ", bunny.cells.length)
  console.log("about to run loop: ", handlesObjArr[0].handles.length)

  console.log("about to run loop: ", bunny.cells)
*/


  function sort(e) {
    if(e[0] < e[1]) {
      return [e[0], e[1]]
    } else {
      return [e[1], e[0]]
    }
  }

  var drawBunny = regl({
    vert: `
    precision mediump float;
    attribute vec3 position;
    attribute vec3 normal;
    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform mat4 view, projection;
    void main() {
      vNormal = normal;
      vPosition = position;

      gl_Position = projection * view * vec4(position, 1);
    }`,

    frag: `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 uEyePos;

    void main() {

      vec3 color = vec3(0.8, 0.0, 0.0);

      vec3 lp = uEyePos;//vec3(0.0, 0.3, 0.0);

      vec3 l = normalize(lp - vPosition);
      vec3 v = normalize(uEyePos - vPosition);

      vec3 lc = vec3(1.0);

      gl_FragColor = vec4(

       0.5*color +
                           0.35*lc*clamp( dot(vNormal, l), 0.0,1.0 )
+                          0.15*lc*pow(clamp(dot(normalize(l+v),vNormal),0.0,1.0)  , 8.0)

                          , 1.0);

//      gl_FragColor = vec4(abs(vNormal), 1.0);

    }`,

    attributes: {
      position: {
        buffer: positionBuffer,
        normalized: true
      },

      normal: bunnyNormals
    },

    elements: bunny.cells,
    primitive: 'triangles'
  })

  var bunnyLines =  require("gl-wireframe")(bunny.cells)
  var bunnyLines = bunnyLines
  var drawBunnyLines = regl({
    vert: `
    precision mediump float;
    attribute vec3 position;
    uniform mat4 view, projection;
    void main() {
      gl_Position = projection * view * vec4(position, 1);
    }`,

    frag: `
    precision mediump float;

    void main() {
      gl_FragColor = vec4(vec3(0.0, 1.0, 0.0)
                          , 1.0);

    }`,

    attributes: {
      position: {
        buffer: positionBuffer,
        normalized: true
      },
    },

    elements: bunnyLines,
    primitive: 'lines'
  })

  var drawBunnyLines2 = regl({
    vert: `
    precision mediump float;
    attribute vec3 position;
    uniform mat4 view, projection;
    void main() {
      gl_Position = projection * view * vec4(position, 1);
    }`,

    frag: `
    precision mediump float;

    void main() {
      gl_FragColor = vec4(vec3(0.0, 0.0, 1.0)
                          , 1.0);

    }`,

    attributes: {
      position: {
        buffer: positionBuffer,
        normalized: true
      },
    },

    elements: bunnyLines2,
    primitive: 'lines'
  })

  // function for deforming the current handle.
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

    console.log("deform: ", offset)
    // deform.
    var d = handlesObj.doDeform(arr, bunny.positions)

    /*
    // now assign the deformed vertices to the mesh.
    for(var i = 0; i < bunny.positions.length; ++i) {
      bunny.positions[i][0] = d[i*3 + 0]
      bunny.positions[i][1] = d[i*3 + 1]
      bunny.positions[i][2] = d[i*3 + 2]
    }
    */

    positionBuffer.subdata(bunny.positions)
  }
  doDeform([+0.0, +0.5, 0.0])
  positionBuffer.subdata(bunny.positions)

  /*
    Setup camera.
  */
  const camera = require('canvas-orbit-camera')(canvas)
  window.addEventListener('resize', fit(canvas), false)
  //camera.rotate([0.0, 0.0], [3.14*0.25, 0.0])
  camera.rotate([0.0, 0.0], [0.0, -0.4])
  camera.rotate([0.0, 0.0], [0.7, 0.0])

  camera.zoom(-29.0)
  //var mb = require('mouse-pressed')(canvas)
  var mp = require('mouse-position')(canvas)
  var projectionMatrix = mat4.perspective([],
                                          Math.PI / 4,
                                          canvas.width / canvas.height,
                                          0.01,
                                          1000)


var v=  [0.33852089662324714,
    -0.43414949181734386,
  0.8348160399229991,
  0,
    -0.1881740866240449,
  0.8380404115639819,
  0.5121316056592331,
  0,
    -0.9219512540699659,
    -0.3304579960397991,
  0.20199850746334924,
  0,
  0,
  0,
    -2.622776508331299,
1]

  const globalScope = regl({
    uniforms: {
      view: () => {
        //return camera.view()
        return v
      },
      projection: () => projectionMatrix,

      uEyePos: () =>{
//        return cameraPosFromViewMatrix([], camera.view())
        return cameraPosFromViewMatrix([], v)

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

  // 1263
/*
  var makeDrawtext = function(arg) {
    var itext =arg //1081

    var up = bunnyNormals[itext]
    var right = [0.0,0.0,0.0]
    var forward = [0.0,0.0,0.0]

    var ret = revisedONB(up)
    right = ret[0]
    forward = ret[1]

    var basis = [
      right[0], right[1], right[2], 0,
      forward[0], forward[1], forward[2], 0,

      up[0], up[1], up[2], 0,

      0    , 0       , 0         , 1
    ]

    //  mat4.transpose(basis, basis)

    var pos = bunny.positions[itext]

    var str = arg + ""
    while(str.length < 4) {
      str = "0" + str
    }

//    var complex = fixCenteredText(str)

    return regl({
      vert: `
      precision mediump float;
      attribute vec2 position;
      uniform mat4 view, projection, rotation;
      uniform vec3 translation, upDir;

      void main() {
        gl_Position = projection * view *

        (vec4(translation, 0.0) +  (vec4(upDir*0.005, 0.0) + rotation * vec4(vec3(position.x, position.y, 0.0), 1.0))

        );
      }`,

      frag: `
      precision mediump float;

      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
      }`,

      attributes: {
        position: () => complex.positions,
      },

      elements: () => complex.cells,

      uniforms: {
        rotation: basis,
        upDir: up,

        translation: pos,

      }
    })

  }
  */


  for(var i = 0; i < handlesObjArr.length; ++i) {
    var ho = handlesObjArr[i]

    var hp = bunny.positions[ho.mainHandle] // handle position
  }

/*
  var drawTexts = []
  var handlesObj = handlesObjArr[0]
  for(var i = 0; i < handlesObj.handles.length; ++i) {
    //var handle = bunny.positions[handlesObj.handles[i]]
    drawTexts.push(makeDrawtext(handlesObj.handles[i]))
  }
  */




  function dist(a, b) {
    return Math.sqrt(  (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1])  )
  }

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

      var minDist = 1000000.0

      var candidates = []

      var ret = getCameraRay()
      var d = ret[0]
      var o = ret[1]

      var minDist = 100000.0
      var minI = -1

      for(var i = 0; i < handlesObjArr.length; ++i) {
        var ho = handlesObjArr[i]

        var hp = bunny.positions[ho.mainHandle] // handle position

        var rp = vec3.subtract([], hp , o)
        var rpmag = vec3.length(rp)

        var rplmag = Math.abs(vec3.dot(rp, d)) / vec3.length(d)

        var dist = Math.sqrt(  rpmag*rpmag - rplmag*rplmag  )


        if(dist < 0.2) {
          candidates.push(i)
        }
      }
      //    handlesObj = handlesObjArr[minI]
//      console.log("PRESSING")
      if(candidates.length > 0) {
        var minDist = 100000.0
        var minI = -1
        for(var j = 0; j < candidates.length; ++j) {
          var i = candidates[j]
          var ho = handlesObjArr[i]
          var hp = bunny.positions[ho.mainHandle] // handle position

          var dist = vec3.distance(hp, o)

          if(minI == -1) {
            minDist = dist
            minI = i
          } else if(dist < minDist) {
            //        candidates.push(i)
            minI = i
            minDist = dist

          }
        }
        //        handlesObj = handlesObjArr[minI]
        isDragging = true
        prevPos = null
      } else {
        handlesObj = null
        isDragging = false
      }


    }
  }

  canvas.addEventListener('mouseup', mouseup, false)
  function mouseup() {
    var mousePos = screenspaceMousePos()

    isDragging = false
  }

  camera.tick()

  console.log("handles: ", handlesObj)

  regl.frame(({viewportWidth, viewportHeight}) => {
    regl.clear({
      depth: 1,
      color: [1, 1, 1, 1]
    })

    globalScope( () => {
      drawBunny()
//      drawBunnyLines2()
//      drawBunnyLines()

      if(handlesObj != null) {


        for(var i = 0; i < handlesObj.handles.length; ++i) {
          //      if(i != 3) continue
          var handle = bunny.positions[handlesObj.handles[i]]

          var c = [0.5, 0.5, 0.5]

          if(i >= handlesObj.afterHandlesMore) { // 3
            c = [1.0, 0.0, 0.0]

          } else if(i >= handlesObj.afterHandles){
            //              continue
              c = [0.0, 1.0, 0.0]

          } else {
            //              continue
             c = [0.0, 0.0, 1.0]

          }

//          drawHandle({pos: handle, color: c})
          //          console.log("i: ", handlesObj.handles[i])
        }
      }

      // render handles
      if(renderHandles) {
        for(var i = 0; i < handlesObjArr.length; ++i) {

          var mh = handlesObjArr[i].mainHandle
          var handle = bunny.positions[mh]

          var c = [0.0, 0.0, 1.0]

          if(handlesObjArr[i] == handlesObj)
            var c = [0.0, 1.0, 0.0]

          //     drawHandle({pos: handle, color: c})

        }
      }

      /*
      for(var i = 0; i < drawTexts.length; ++i) {
//        drawTexts[i]()

      }
      */
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
}

  /*
    var fc = []
    for(var i = 0; i < bunny.positions.length; ++i) {
    fc[i] = 0
    }

    for(var i = 0; i < newHandlesObj.handles.length; ++i) {
    var e = newHandlesObj.handles[i]
    fc[e]++
    if(fc > 1) {
    console.log("THIS IS BAD")
    }
    }
  */
