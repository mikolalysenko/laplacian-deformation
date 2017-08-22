const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
var control = require('control-panel')
var bunny = require('bunny')
const fit = require('canvas-fit')
var ch = require('conway-hart')
var cameraPosFromViewMatrix   = require('gl-camera-pos-from-view-matrix');
var sphereMesh = require('primitive-sphere')(1.0, { segments: 16 })
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

// copy of the mesh, that we use when restoring the mesh.
var copyBunny = JSON.parse(JSON.stringify(bunny))

function dist(u, v) {
  var dx = u[0] - v[0]
  var dy = u[1] - v[1]
  var dz = u[2] - v[2]

  return Math.sqrt(dx*dx + dy*dy + dz*dz)
}

// make an object that can be used to deform a section of the mesh.
// The function will deform the vertex with index mainHandle, and
// vertices that are close enough it.
function makeHandlesObj(mainHandle) {
  var newHandlesObj = {
    handles: []
  }

  newHandlesObj.handles.push(mainHandle)

  // add all vertices that are close enough to main handle.
  // these vertices are deformed together with the main handle.
  for(var j = 0; j < bunny.positions.length; ++j) {
    var p = bunny.positions[j]
    var accept = false
    if(dist(bunny.positions[newHandlesObj.handles[0]], p) < 0.16) {
      accept = true
    }

    if(accept) {
      newHandlesObj.handles.push(j)
    }
  }

  // now we begin adding some more handles.
  // These handles will NOT be moved during deformation.
  // Their positions are kept constant, and so they serve as
  //n anchors that ensures that the mesh keeps it general shape.

  newHandlesObj.afterHandles = newHandlesObj.handles.length
  for(var j = 0; j < bunny.positions.length; ++j) {
    var p = bunny.positions[j]
    var accept = true
    for(var i = 0; i < newHandlesObj.handles.length; ++i) {
      if(dist(bunny.positions[newHandlesObj.handles[i]], p) < 0.16) {
        accept = false
        break
      }
    }

    if(accept) {
      newHandlesObj.handles.push(j)
    }
  }

  newHandlesObj.doDeform = prepareDeform(bunny.cells, bunny.positions, newHandlesObj.handles)
  newHandlesObj.mainHandle = mainHandle
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

  handlesObjArr.push(makeHandlesObj(workItems[iWork]))
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
  // set current handle that we're manipulating.
  var handlesObj = handlesObjArr[0]
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
      var handlesObj = handlesObjArr[0]
      doDeform([+0.0, +0.0, 0.0])
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
      vec3 ambient = 0.6 * color;
      gl_FragColor = vec4(ambient +
                          0.25 *color*clamp( dot(vNormal, vec3(0.39, 0.87, 0.29)), 0.0,1.0 )
                          +
                          0.25 *color*clamp( dot(vNormal, vec3(-0.39, 0.87, -0.29)), 0.0,1.0 )


                          , 1.0);

    }`,

    attributes: {
      position: {
        buffer: positionBuffer,
        normalized: true
      },

      normal: normals(bunny.cells, bunny.positions)
    },

    elements: bunny.cells,
    primitive: 'triangles'
  })

  // function for deforming the current handle.
  function doDeform(offset) {

    if(!handlesObj)
      return
    var arr = []
    for(var i = 0; i < handlesObj.handles.length; ++i) {
      arr[i] = []
    }
    var arr = []

    for(var i = 0; i < handlesObj.handles.length; ++i) {
      var hi = handlesObj.handles[i]

      // these handles are deformed.
      if(i < handlesObj.afterHandles
        ) {
        arr[i] = [
          bunny.positions[hi][0] + offset[0],
          bunny.positions[hi][1] + offset[1],
          bunny.positions[hi][2] + offset[2]
        ]

        // and these ones are not moved at all.
        // they serve as anchors, that nail down the mesh.
      } else {
        arr[i] = [
          bunny.positions[hi][0],
          bunny.positions[hi][1],
          bunny.positions[hi][2]
        ]
      }
    }

    // deform.
    var d = handlesObj.doDeform(arr)

    // now assign the deformed vertices to the mesh.
    for(var i = 0; i < bunny.positions.length; ++i) {
      bunny.positions[i][0] = d[i*3 + 0]
      bunny.positions[i][1] = d[i*3 + 1]
      bunny.positions[i][2] = d[i*3 + 2]
    }

    positionBuffer.subdata(bunny.positions)
  }
  doDeform([+0.0, +0.0, 0.0])

  /*
    Setup camera.
  */
  const camera = require('canvas-orbit-camera')(canvas)
  window.addEventListener('resize', fit(canvas), false)
  camera.rotate([0.0, 0.0], [0.0, -0.4])
  camera.zoom(-30.0)
  //var mb = require('mouse-pressed')(canvas)
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

      uEyePos: cameraPosFromViewMatrix([], camera.view())

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
      gl_Position = projection * view * vec4(position*0.015 + pos, 1);
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
        handlesObj = handlesObjArr[minI]
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

  regl.frame(({viewportWidth, viewportHeight}) => {
    regl.clear({
      depth: 1,
      color: [1, 1, 1, 1]
    })

    globalScope( () => {
      drawBunny()

      // if(handlesObj != null) {

      //   for(var i = 0; i < handlesObj.handles.length; ++i) {
      //     //      if(i != 3) continue
      //     var handle = bunny.positions[handlesObj.handles[i]]

      //     var c = [0.0, 1.0, 0.0]

      //     if(i == 0) { // 3
      //       c = [0.0, 0.0, 1.0]
      //     }

      //     drawHandle({pos: handle, color: c})
      //   }
      // }


      // render handles
      if(renderHandles) {
        for(var i = 0; i < handlesObjArr.length; ++i) {

          var mh = handlesObjArr[i].mainHandle
          var handle = bunny.positions[mh]

          var c = [0.0, 0.0, 1.0]

          if(handlesObjArr[i] == handlesObj)
            var c = [0.0, 1.0, 0.0]

          drawHandle({pos: handle, color: c})

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
}
