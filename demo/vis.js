const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
var control = require('control-panel')
var rayTriIntersect = require('ray-triangle-intersection');
const fit = require('canvas-fit')
const canvas = document.body.appendChild(document.createElement('canvas'))
var mousePosition = require('mouse-position')(canvas)

const regl = require('regl')({canvas: canvas})
const camera = require('./modified-regl-camera.js')(regl, {
  center: [0, 0.0, 0],
  distance : 2.0,
  rotationSpeed: 0.5,
  phi: 1.1,
  renderOnDirty : false
})

window.addEventListener('resize', fit(canvas), false)

var cameraPosFromViewMatrix   = require('gl-camera-pos-from-view-matrix')

//var targetMesh = require('stanford-dragon/2')
//var targetMesh = require('../meshes/Armadillo.json')
var targetMesh = require('../meshes/armadillo_low_res.json')
var defaultSelectHandle = 2096

var guiParams = {
  'handles_rings': 7,
  'unconstrained_rings': 13,

}

//var targetMesh = require('../meshes/sphere.json')
//var targetMesh = require('../meshes/bunny.json')
//var targetMesh = require('bunny')

// get screen space mouse position, in range [-1,+1] for both x and y coordinates.
function clipspaceMousePos() {
  return [2.0 * mousePosition[0] / canvas.width - 1.0, -2.0 * mousePosition[1] / canvas.height + 1.0]
}

// given the view and projection matrices of the camera,
// get a ray starting from the camera position, heading in the viewing direction of the camera.
function getCameraRay(viewMatrix, projectionMatrix) {
  var mousePos = clipspaceMousePos()

  var vp = []
  mat4.multiply(vp, projectionMatrix, viewMatrix)

  var inverseVp = []
  mat4.invert(inverseVp, vp)

  var v = []
  vec3.transformMat4(v, [mousePos[0], mousePos[1], 0], inverseVp)

  var camPos = cameraPosFromViewMatrix([], viewMatrix)

  var d = [v[0] - camPos[0], v[1] - camPos[1], v[2] - camPos[2]]
  var o = [camPos[0], camPos[1], camPos[2]]

  vec3.normalize(d, d)

  return [d, o] // ray direction, ray origin.
}

function getAdj(mesh) {
  var adj = []
  for(var i = 0; i < mesh.positions.length; ++i) {
    adj[i] = []
  }

  for(var i = 0; i < mesh.cells.length; ++i) {
    var c = mesh.cells[i]
    for(var j = 0; j < 3; ++j) {
      var a = c[j+0]
      var b = c[(j+1) % 3]
      adj[a].push(b)
    }
  }

  return adj
}

function fitMesh(mesh) {
  var aabb = {
    min: [+Number.MAX_VALUE, +Number.MAX_VALUE, +Number.MAX_VALUE],
    max: [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE],
  }

  /*
    Find AABB for mesh.
  */
  for(var j = 0; j < mesh.positions.length; ++j) {
    var p = mesh.positions[j]

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

  for(var j = 0; j < mesh.positions.length; ++j) {

    var p = mesh.positions[j]

    p[0] += t[0]
    p[1] += t[1]
    p[2] += t[2]

    p[0] *= s
    p[1] *= s
    p[2] *= s
  }
}

require("../index.js").load(function(initModule, prepareDeform, doDeform, freeModule) {
  fitMesh(targetMesh)

  var adj = getAdj(targetMesh)

  initModule(targetMesh)

  targetMesh.normals = normals(targetMesh.cells, targetMesh.positions)
  var copyMesh = JSON.parse(JSON.stringify(targetMesh))

  // dynamic buffers that are sent into regl.
  const positionBuffer = regl.buffer({
    length: targetMesh.positions.length * 3 * 4,
    type: 'float',
    usage: 'dynamic'
  })
  positionBuffer.subdata(targetMesh.positions)

  const colorBuffer = regl.buffer({
    length: targetMesh.positions.length * 3 * 4,
    type: 'float',
    usage: 'dynamic'
  })

  // command for drawing the target mesh.
  var drawMesh = regl({
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

    uniform vec3 eye;

    void main() {

      vec3 color = vColor + vec3(0.0, 0.0, 0.4);

      vec3 lp = eye;

      vec3 l = normalize(lp - vPosition);
      vec3 v = normalize(eye - vPosition);

      gl_FragColor = vec4(
        0.5*color
          + vec3(0.35)*clamp( dot(vNormal, l), 0.0,1.0 )
          + vec3(0.15)*pow(clamp(dot(normalize(l+v),vNormal),0.0,1.0)  , 8.0)
        , 1.0);

    }`,

    attributes: {
      position: {
        buffer: positionBuffer,
        normalized: true
      },

      normal: targetMesh.normals,

      color: {
        buffer: colorBuffer,
        normalized: true
      },

    },

    elements: targetMesh.cells,
    primitive: 'triangles'
  })

  var roi = {
  }


  /*
    Create GUI

  */
  var container = document.createElement('div')
  var str = `<a href="https://github.com/mikolalysenko/laplacian-deformation"><img style="position: absolute; top: 0; left: 0; border: 0;" src="https://camo.githubusercontent.com/82b228a3648bf44fc1163ef44c62fcc60081495e/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f6c6566745f7265645f6161303030302e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_left_red_aa0000.png"></a>`

  container.innerHTML = str
  document.body.appendChild(container)

  var panel = control([
    {type: 'range', label: 'handles_rings', min: 3, max: 20, initial: 7, step: 1},

    {type: 'range', label: 'unconstrained_rings', min: 3, max: 40, initial: 13, step:1},

    {type: 'button', label: 'Reset Mesh', action: function () {
      targetMesh = JSON.parse(JSON.stringify(copyMesh))

      positionBuffer.subdata(targetMesh.positions)

      freeModule()
      initModule(targetMesh)

      selectHandle(dragTarget)

    }},
  ], {theme: 'light', position: 'top-right'}).on('input', data => { guiParams = data })

  var par = document.createElement("h3")
  par.innerHTML = "Click near the white handles and drag to deform the mesh. Hold \"T\"-key and press the mesh, to select a new region of deformation. This takes a while though."

  var div = document.createElement('div')
  div.style.cssText = 'color: #000; position: absolute; bottom: 0px; width: 300; padding: 5px; z-index:100;'
  div.style.fontSize = '10px'
  div.appendChild(par)
  document.body.appendChild(div)

  function offsetDeform(offset) {
    if(!roi)
      return

    var handlesPositionsArr = []
    var j = 0
    for(var i = 0; i < (roi.handles.length); ++i) {
      handlesPositionsArr[j++] =
        [
          targetMesh.positions[roi.handles[i]][0]  + offset[0],
          targetMesh.positions[roi.handles[i]][1]  + offset[1],
          targetMesh.positions[roi.handles[i]][2]  + offset[2]
        ]
    }

    var result = doDeform(handlesPositionsArr)

    for(var i = 0 ; i < targetMesh.positions.length; i+=1) {
      targetMesh.positions[i] = result[i]
    }

    positionBuffer.subdata(targetMesh.positions)
  }


  var prevPos = null
  var prevMousePos = null
  var dragTarget = null

  function selectHandle(mainHandle) {
    dragTarget = mainHandle

    var currentRing = [mainHandle]

    prevPos = null
    prevMousePos = null
    var visited = []
    for(var i = 0; i < targetMesh.positions.length; ++i) {
      visited[i] = false
    }

    roi.handles = []

    var unconstrainedSet = []
    var handlesSet = []

    for(var i = 0; i < targetMesh.positions.length; ++i) {
      unconstrainedSet[i] = false
      handlesSet[i] = false
    }

    for(var iter = 0; iter < guiParams.handles_rings; ++iter) {

      var nextRing = []

      for(var i = 0; i < currentRing.length; ++i) {
        var e = currentRing[i]

        if(visited[e])
          continue

        roi.handles.push(e)
        visited[e] = true
        handlesSet[e] = true

        var adjs = adj[e]

        for(var j = 0; j < adjs.length; ++j) {
          nextRing.push(adjs[j])
        }
      }
      currentRing = nextRing
    }

    roi.unconstrained = []


    for(var iter = 0; iter < guiParams.unconstrained_rings; ++iter) {

      var nextRing = []

      for(var i = 0; i < currentRing.length; ++i) {
        var e = currentRing[i]

        if(visited[e])
          continue

        roi.unconstrained.push(e)
        visited[e] = true
        unconstrainedSet[e] = true

        var adjs = adj[e]
        for(var j = 0; j < adjs.length; ++j) {
          nextRing.push(adjs[j])
        }
      }
      currentRing = nextRing
    }

    roi.boundary = []

    var boundaryIndices = []
    for(var i = 0; i < currentRing.length; ++i) {
      var e = currentRing[i]

      if(visited[e])
        continue

      boundaryIndices.push(e)
      roi.boundary.push(e)

      visited[e] = true
    }

    prepareDeform(roi.handles, roi.unconstrained, roi.boundary)

    var colors = []
    for(var i = 0; i < targetMesh.normals.length; ++i) {
      colors[i] = [0.4, 0.4, 0.4];
      if(handlesSet[i] === true) {
        colors[i] = [0.3, 0.3, 0.0];
      } else if(unconstrainedSet[i] === true) {
        colors[i] = [0.0, 0.0, 0.3];
      } else {
        colors[i] = [0.0, 0.0, 0.0];
      }
    }
    colorBuffer.subdata(colors)

  }

  selectHandle(defaultSelectHandle)

  var isDragging = false
  var isPicking = false

  window.onkeydown = function(e) {
    var key = e.keyCode ? e.keyCode : e.which;

    if (key == 84) { // t
      isPicking = true
    }
  }

  window.onkeyup = function(e) {
    var key = e.keyCode ? e.keyCode : e.which;

    if (key == 84) {
      isPicking = false
    }
  }

  canvas.addEventListener('mouseup', mouseup, false)
  function mouseup() {
    isDragging = false
  }

  var curView = null
  var curProjection = null

  function mousedown(ev) {
    if(isPicking) {
      var ret = getCameraRay(camera.view, camera.projection)
      var d = ret[0]
      var o = ret[1]

      var minDist = Number.MAX_VALUE
      var minHandle = -1

      for(var i = 0; i < targetMesh.cells.length; ++i) {
        var c = targetMesh.cells[i]

        var p0 = targetMesh.positions[c[0]]
        var p1 = targetMesh.positions[c[1]]
        var p2 = targetMesh.positions[c[2]]

        var intersectPoint = rayTriIntersect([], o, d, [p0, p1, p2])

        if(intersectPoint != null) {
          var dist = vec3.distance(intersectPoint, o)

          if(dist < minDist) {
            minDist = dist
            minHandle = c[0]
            break
          }
        }
      }

      if(minHandle != -1) {
        selectHandle(minHandle)
      }

    } else {
      if (ev.button === 0) {
        isDragging = true
      }
    }
  }

  canvas.addEventListener('mousedown', mousedown, false)
  regl.frame(({}) => {


    regl.clear({
      depth: 1,
      color: [1, 1, 1, 1]
    })

    camera(() => {
      /*
        When clicking mouse, pick handle that is near enough to mouse, and closest to the camera.
      */

      curView = camera.view
      curProjection = camera.projection

      drawMesh()

      // if the mouse is moved while left mouse-button is down,
      // the main handle should follow the mouse.
      // the below calculations ensure this.
      if(isDragging) {
        var ret = getCameraRay(camera.view, camera.projection)
        var d = ret[0]
        var o = ret[1]

        var mousePos = clipspaceMousePos()

        var pr0 = targetMesh.positions[dragTarget]
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

            offsetDeform(def)
          }

        }
        prevPos = p
        prevMousePos = mousePos
      }

    })

  })
})
