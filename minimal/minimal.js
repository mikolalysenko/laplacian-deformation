const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const fit = require('canvas-fit')
var cameraPosFromViewMatrix   = require('gl-camera-pos-from-view-matrix');
const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')({canvas: canvas})

const camera = require('canvas-orbit-camera')(canvas)
window.addEventListener('resize', fit(canvas), false)
camera.zoom(-29.0)

var targetMesh = require('../meshes/sphere.json')

require("../index.js").load(function(initModule, prepareDeform, doDeform, freeDeform) {
  targetMesh.normals = normals(targetMesh.cells, targetMesh.positions)

  initModule(targetMesh)

  var handles = [0,2,4,1,3,45,36,16,5,15,8,7,49,12,26,37,47,35]
  var unconstrained = [17,25,11,19,22,9,6,50,10,48,13,27,42,41,46,39,21,29,32,14,18,20,23,64,72,65,71,61,75,62,31,40,43,44,74,38,24,28,30,33,54,55,51,52,66,152,73,68,78,63,76,149,34,81,85,82,155,84]
  var stationary = [94,95,91,92,56,58,53,161,69,151,150,77,67,79,147,154,148,83,88,86,153,158]

  prepareDeform(handles, unconstrained, stationary)

  var offset = [-0.340, 0.35, 0.073]
  var handlesPositionsArr = []

  for(var i = 0; i < (handles.length); ++i) {
    handlesPositionsArr[i] =
      [
        targetMesh.positions[handles[i]][0]  + offset[0],
        targetMesh.positions[handles[i]][1]  + offset[1],
        targetMesh.positions[handles[i]][2]  + offset[2]
      ]
  }

  var result = doDeform(handlesPositionsArr)

  for(var i = 0 ; i < targetMesh.positions.length; i+=1) {
    targetMesh.positions[i] = result[i]
  }

  freeDeform()


  // regl command for drawing the target mesh.
  var drawMesh = regl({
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
      vec3 color = vec3(0.0, 0.0, 0.4);
      vec3 l = normalize(uEyePos - vPosition);
      gl_FragColor = vec4(
        0.5*color
          + vec3(0.35)*clamp( dot(vNormal, l), 0.0,1.0 )
        , 1.0);
    }`,

    attributes: {
      position:  targetMesh.positions,
      normal: targetMesh.normals,
    },

    uniforms: {
      view: () => camera.view(),
      projection: () => mat4.perspective([], Math.PI / 4, canvas.width / canvas.height, 0.01, 1000),
      uEyePos: () => cameraPosFromViewMatrix([], camera.view())
    },
    elements: targetMesh.cells,
    primitive: 'triangles'
  })

  regl.frame(({}) => {
    regl.clear({
      depth: 1,
      color: [1, 1, 1, 1]
    })
    drawMesh()
    camera.tick()
  })
})
