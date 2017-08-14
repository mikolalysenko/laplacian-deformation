const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')

var bunny = require('bunny')
const fit = require('canvas-fit')
var ch = require('conway-hart')

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


var handlesPos = [ ]
var handles = []

function dist(u, v) {
  var dx = u[0] - v[0]
  var dy = u[1] - v[1]
  var dz = u[2] - v[2]

  return Math.sqrt(dx*dx + dy*dy + dz*dz)
}

for(var j = 0; j < bunny.positions.length; ++j) {
  var p = bunny.positions[j]
  var accept = true
  for(var i = 0; i < handles.length; ++i) {
    if(dist(bunny.positions[handles[i]], p) < 0.2) {
      accept = false
      break
    }
  }

  if(accept) {
    handles.push(j)
  }
}
// adjacency structure.
var adj = []
var visited = []

for(var i = 0; i < bunny.positions.length; ++i) {
  adj[i] = []
  visited[i] = false
}

for(var i = 0; i < bunny.cells.length; ++i) {

  var c = bunny.cells[i]

  for(var j = 0; j < 3; ++j) {

    var a = c[j+0]
    var b = c[(j+1) % 3]

    adj[a].push(b)
  }
}

var A = handles[3]
visited[A] = true
var queue = []
//queue.push(A)
for(var i = 0; i < adj[A].length; ++i) {
//  handles.push(adj[A][i])
//  visited[adj[A][i]] = true

  queue.push(adj[A][i])
}

var afterHandles = handles.length

while(handles.length < 30) {
  var e = queue.shift()

  if(visited[e]) {
    // fuck it, already visited.
    continue
  }

  visited[e] = true
  handles.push(e)

  for(var i = 0; i < adj[e].length; ++i) {
    queue.push(adj[e][i])
  }
}

for(var i = 0; i < handles.length; ++i) {
  var p = bunny.positions[handles[i]]
  handlesPos.push(p)
}

var deform = require('../index')

var calcMesh = deform(bunny.cells, bunny.positions, handles)






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

var arr = []
for(var i = 0; i < handles.length; ++i) {
  arr[i] = []
}


function mydeform(offset) {
  //  offset = [+0.2, +0.30, -0.14]

//  bunny = JSON.parse(JSON.stringify(copyBunny))

  var arr = []

  for(var i = 0; i < handles.length; ++i) {
    var hi = handles[i]

    if(i == 3
       || i >= afterHandles

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

  var d = calcMesh(arr)

  for(var i = 0; i < bunny.positions.length; ++i) {
    bunny.positions[i][0] = d[i*3 + 0]
    bunny.positions[i][1] = d[i*3 + 1]
    bunny.positions[i][2] = d[i*3 + 2]
  }


  positionBuffer.subdata(bunny.positions)
}

mydeform([+0.2, +0.30, -0.14])


const camera = require('canvas-orbit-camera')(canvas)
window.addEventListener('resize', fit(canvas), false)

camera.rotate([0.0, 0.0], [0.0, -0.4])
camera.zoom(-20.0)
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

var isDragging = true
var omp // original mouse pos



const drawHandle = regl({
  vert: `
  precision mediump float;
  attribute vec3 position;
  uniform mat4 view, projection;
  void main() {

//    gl_PointSize = 10.0;
    gl_PointSize = 3.0;

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

canvas.addEventListener('mousedown', mousedown, false)
function mousedown() {

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

//mb.on('down', function () {
//  var vp = mat4.multiply([], projectionMatrix, viewMatrix)
  //  var rayPoint = vec3.transformMat4([], [2.0 * mp[0] / canvas.width - 1.0, -2.0 * mp[1] / canvas.height + 1.0, 0.0], invVp)

  var mousePos = screenspaceMousePos()

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

  if(!found) {
    pickedHandle = -1
    isDragging = false
  } else {
    isDragging = true

    omp = [mousePos[0], mousePos[1]]
  }
}

canvas.addEventListener('mouseup', mouseup, false)
function mouseup() {

  isDragging = false
}


regl.frame(({viewportWidth, viewportHeight}) => {
  regl.clear({
    depth: 1,
    color: [1, 1, 1, 1]
  })

  globalScope( () => {
    drawBunny()

    for(var i = 0; i < handlesPos.length; ++i) {
//      if(i != 3) continue
      var handle = handlesPos[i]

      var c = [0.0, 1.0, 0.0]

      if(pickedHandle == i) {
        c = [1.0, 0.0, 0.0]
      }

      if(i == 3) { // 3
        c = [0.0, 0.0, 1.0]
      }

//      drawHandle({pos: handle, color: c})
    }
  })

  camera.tick()
})

// all way left is -1= x.
// all way left is +1= x
// all way down is -1= y
