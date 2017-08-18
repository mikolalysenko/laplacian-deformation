const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')

var bunny = require('bunny')
const fit = require('canvas-fit')
var ch = require('conway-hart')
var cameraPosFromViewMatrix   = require('gl-camera-pos-from-view-matrix');

var aabb = {
  min: [+1000, +1000, +1000],
  max: [-1000, -1000, -1000],
}

// find AABB for bunny.
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

// center translation
var t = [
    -0.5 * (aabb.min[0] + aabb.max[0]),
    -0.5 * (aabb.min[1] + aabb.max[1]),
    -0.5 * (aabb.min[2] + aabb.max[2]),
]

// i longest.
var il = 0

for(var i = 1; i < 3; ++i) {

  if( (aabb.max[i]-aabb.min[i]) >  aabb.max[il]-aabb.min[il] )   {
    il = i
  }
}
var s = 1.0 / (aabb.max[il]-aabb.min[il])

for(var j = 0; j < bunny.positions.length; ++j) {

  var p = bunny.positions[j]

  p[0] += t[0]
  p[1] += t[1]
  p[2] += t[2]

  p[0] *= s
  p[1] *= s
  p[2] *= s
}

var copyBunny = JSON.parse(JSON.stringify(bunny))
var deform = require('../index')

function dist(u, v) {
  var dx = u[0] - v[0]
  var dy = u[1] - v[1]
  var dz = u[2] - v[2]

  return Math.sqrt(dx*dx + dy*dy + dz*dz)
}

function makeHandlesObj(mainHandle) {
  var newHandlesObj = {
    handles: []
  }

  newHandlesObj.handles.push(mainHandle)

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

  newHandlesObj.calcMesh = deform(bunny.cells, bunny.positions, newHandlesObj.handles)
  newHandlesObj.mainHandle = mainHandle
  //console.log(handles[4])
  return newHandlesObj
}

//var handlesObj1 = makeHandlesObj(40)
var handlesObjArr = [makeHandlesObj(40), makeHandlesObj(675)]

var handlesObj = handlesObjArr[0]

const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')({canvas: canvas})

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
  uniform mat4 view, projection;
  void main() {
    vNormal = normal;
    gl_Position = projection * view * vec4(position, 1);
  }`,

  frag: `
  precision mediump float;
  varying vec3 vNormal;
  void main() {
    vec3 color = vec3(0.8, 0.0, 0.0);
    vec3 lightDir = vec3(0.39, 0.87, 0.29);
    vec3 ambient = 0.5 * color;
    vec3 diffuse = 0.5 * color * clamp( dot(vNormal, lightDir), 0.0, 1.0 );
    gl_FragColor = vec4(ambient + diffuse, 1.0);
  }`,

  attributes: {
    position: {
      buffer: positionBuffer,
      normalized: true
    },

    //bunny.positions,
    normal: normals(bunny.cells, bunny.positions)
  },

  elements: bunny.cells,
  primitive: 'triangles'
})




function mydeform(offset) {
  var arr = []
  for(var i = 0; i < handlesObj.handles.length; ++i) {
    arr[i] = []
  }
  //  offset = [+0.2, +0.30, -0.14]
  var arr = []

  for(var i = 0; i < handlesObj.handles.length; ++i) {
    var hi = handlesObj.handles[i]

    if(i < handlesObj.afterHandles

      ) {
      arr[i] = [
        bunny.positions[hi][0] + offset[0],
        bunny.positions[hi][1] + offset[1],
        bunny.positions[hi][2] + offset[2]
      ]

    } else {
      arr[i] = [
        bunny.positions[hi][0],
        bunny.positions[hi][1],
        bunny.positions[hi][2]
      ]
    }
  }

  var d = handlesObj.calcMesh(arr)

  for(var i = 0; i < bunny.positions.length; ++i) {
    bunny.positions[i][0] = d[i*3 + 0]
    bunny.positions[i][1] = d[i*3 + 1]
    bunny.positions[i][2] = d[i*3 + 2]
  }


  positionBuffer.subdata(bunny.positions)
}
mydeform([+0.0, +0.0, 0.0])

//ydeform([+0.2, +0.30, -0.14])


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

var pickedHandle = -1

const globalScope = regl({
  uniforms: {
    view: () => {
      return camera.view()
    },
    projection: () => projectionMatrix

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

  // ray direction and origin
  var d = [v[0] - camPos[0], v[1] - camPos[1], v[2] - camPos[2]]
  var o = [camPos[0], camPos[1], camPos[2]]

  return [d, o]
}

var isDragging = false
var omp // original mouse pos



const drawHandle = regl({
  vert: `
  precision mediump float;
  attribute vec3 position;
  uniform mat4 view, projection;
  void main() {

    //    gl_PointSize = 10.0;
    gl_PointSize = 5.0;

    gl_Position = projection * view * vec4(
      position
      // 0.0, 20.0, 0.0

      , 1);
  }`,

  frag: `
  precision mediump float;

  uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, 1.0);
  }`,

  attributes: {
    position: (_, props) => {
      return props.pos
    }
  },
  primitive: 'points',
  count: 1,

  uniforms: {
    color: (_, props) => {
      return props.color
    }
  }
})

function dist(a, b) {
  return Math.sqrt(  (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1])  )
}

var counter = 0
var movecamera = false

window.onkeydown = function(e) {
  var key = e.keyCode ? e.keyCode : e.which;

  if (key == 81) {
    movecamera = true
  }
}

window.onkeyup = function(e) {
  var key = e.keyCode ? e.keyCode : e.which;

  if (key == 81) {
    movecamera = false
  }

  if (key == 49) {
    handlesObj = handlesObjArr[0]
    console.log("obj1")
  } else if (key == 50) {
    handlesObj = handlesObjArr[1]
    console.log("obj2")
  }

  if (key == 82) {
    if(counter==0) {
      mydeform([+0.4, +0.0, -0.0])
    } else if(counter==1) {
      mydeform([-0.4, +0.0, -0.0])
    }else if(counter==2) {
      mydeform([+0.0, +0.4, -0.0])
    }else if(counter==3) {
      mydeform([+0.0, -0.4, -0.0])
    }else if(counter==4) {
      mydeform([+0.0, +0.0, +0.4])
    }else if(counter==5) {
      mydeform([+0.0, -0.0, -0.4])
    }

    counter++
  }
}

canvas.addEventListener('mousedown', mousedown, false)
function mousedown() {
  /*
    var viewMatrix = camera.view()
    var vp = mat4.multiply([], projectionMatrix, viewMatrix)
    var found = false
    for(var i = 0; i < handlesPos.length; ++i) {
    var hp = (vec3.transformMat4([], handlesPos[i], vp))

    var d = dist(  mousePos, [hp[0], hp[1]] )

    if(d < 0.1) {
    pickedHandle = i
    found = true
    break
    }
    }
  */



  if(!movecamera) {
    isDragging = true

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

    for(var i = 0; i < handlesObj.handles.length; ++i) {
      //      if(i != 3) continue
      var handle = bunny.positions[handlesObj.handles[i]]

      var c = [0.0, 1.0, 0.0]

      if(pickedHandle == i) {
        c = [1.0, 0.0, 0.0]
      }

      if(i == 0) { // 3
        c = [0.0, 0.0, 1.0]
      }

      drawHandle({pos: handle, color: c})
    }
  })

  if(isDragging) {

    var ret = getCameraRay()
    var d = ret[0]
    var o = ret[1]


    // plane point, and normal.
    var pr0 = bunny.positions[handlesObj.handles[0]]
    var pn = [o[0] - pr0[0], o[1] - pr0[1], o[2] - pr0[2]]

    vec3.normalize(pn, pn)

    var t = (vec3.dot(pn, pr0) - vec3.dot(pn, o)) / vec3.dot(d, pn)

    var p = vec3.add([],  o,   vec3.scale([], d, t)   )
    //p - pr0
    var def = vec3.subtract([], p, pr0)

    mydeform(def)

  }

  if(movecamera) {
    camera.tick()
  }

})

// all way left is -1= x.
// all way left is +1= x
// all way down is -1= y
