const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')

const bunny = require('bunny')
const fit = require('canvas-fit')

const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')({canvas: canvas})
const camera = require('canvas-orbit-camera')(canvas)
window.addEventListener('resize', fit(canvas), false)

camera.rotate([0.0, 0.0], [0.0, -0.4])
camera.zoom(10.0)
//var mb = require('mouse-pressed')(canvas)
var mp = require('mouse-position')(canvas)

var projectionMatrix = mat4.perspective([],
                       Math.PI / 4,
                       canvas.width / canvas.height,
                       0.01,
                       1000)

var pickedHandle = -1
var handles = [
  [0.0, 7.0, 0.0], // 7
  [10.0, 10.0, 0.0],
]

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


const drawBunny = regl({
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
    position: bunny.positions,
    normal: normals(bunny.cells, bunny.positions)
  },

  elements: bunny.cells,
})



const drawHandle = regl({
  vert: `
  precision mediump float;
  attribute vec3 position;
  uniform mat4 view, projection;
  void main() {

//    gl_PointSize = 10.0;
    gl_PointSize = 8.0;

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

console.log(canvas.width, canvas.height)

function dist(a, b) {
  return Math.sqrt(  (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1])  )
}



canvas.addEventListener('mousedown', mousedown, false)
function mousedown() {
//mb.on('down', function () {
//  var vp = mat4.multiply([], projectionMatrix, viewMatrix)
  //  var rayPoint = vec3.transformMat4([], [2.0 * mp[0] / canvas.width - 1.0, -2.0 * mp[1] / canvas.height + 1.0, 0.0], invVp)

//  console.log("DOWNWWWWW")

  var mousePos = screenspaceMousePos()

  var viewMatrix = camera.view()
  var vp = mat4.multiply([], projectionMatrix, viewMatrix)

  var found = false
  for(var i = 0; i < handles.length; ++i) {
    var hp = (vec3.transformMat4([], handles[i], vp))

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

    console.log(omp)
  }
}

canvas.addEventListener('mouseup', mouseup, false)
function mouseup() {

  isDragging = false

//  console.log("MOUSE UP")
}


regl.frame(({viewportWidth, viewportHeight}) => {
  regl.clear({
    depth: 1,
    color: [1, 1, 1, 1]
  })

  globalScope( () => {
    drawBunny()

    for(var i = 0; i < handles.length; ++i) {
      var handle = handles[i]

      var c = [0.0, 1.0, 0.0]

      if(pickedHandle == i) {
        c = [1.0, 0.0, 0.0]
      }

      drawHandle({pos: handle, color: c})
    }
  })

  camera.tick()
})

// all way left is -1= x.
// all way left is +1= x
// all way down is -1= y
