const normals = require('angle-normals')
const fit = require('canvas-fit')
const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')({canvas: canvas})

const camera = require('regl-camera')(regl, {
  center: [0, 0.0, 0],
  distance : 2.0,
  rotationSpeed: 0.5,
  phi: 1.1
})

window.addEventListener('resize', fit(canvas), false)

var targetMesh = require('../meshes/sphere.json')

// vertices that specify the region of deformation.
var handles = [
0,2,4,1,3,45,36,16,5,15,8,7,49,12,26,37,47,35, // these are vertices that we move

94,95,91,92,56,58,53,161,69,151,150,77,67,79,147,154,148,83,88,86,153,158 // the boundary vertices. we don't move these.
]
var unconstrained = [17,25,11,19,22,9,6,50,10,48,13,27,42,41,46,39,21,29,32,14,18,20,23,64,72,65,71,61,75,62,31,40,43,44,74,38,24,28,30,33,54,55,51,52,66,152,73,68,78,63,76,149,34,81,85,82,155,84]
var beginBoundaryVertices = 18 // beginning index of boundary vertices in `handles` array.

require("../index.js").load(function(initModule, prepareDeform, doDeform, freeModule) {
  targetMesh.normals = normals(targetMesh.cells, targetMesh.positions)

  targetMesh.colors = []
  for(var i = 0; i < targetMesh.positions.length; ++i) {
    targetMesh.colors[i] = [0.5, 0.5, 0.5];
  }

  // assign colors to vertices for visualization.
  for(var i = 0; i < handles.length; ++i) { targetMesh.colors[handles[i]] = [0.6, 0.6, 0.0] }
  for(var i = 0; i < unconstrained.length; ++i) { targetMesh.colors[unconstrained[i]] = [0.0, 0.0, 0.6] }

  initModule(targetMesh) // must call this before using the module!

  prepareDeform(handles, unconstrained)

  // we do a very simple deformaton: we offset all handle vertices by a vector.
  var offset = [-0.136, 0.140, 0.0292]
  var handlesPositionsArr = []
  for(var i = 0; i < handles.length; ++i) {
      
    if(i >= beginBoundaryVertices) { 
    handlesPositionsArr[i] =
      [
        targetMesh.positions[handles[i]][0],
        targetMesh.positions[handles[i]][1],
        targetMesh.positions[handles[i]][2]
      ]
    } else {   
      
    handlesPositionsArr[i] =
      [
        targetMesh.positions[handles[i]][0]  + offset[0],
        targetMesh.positions[handles[i]][1]  + offset[1],
        targetMesh.positions[handles[i]][2]  + offset[2]
      ]   
    }
  }
  var result = doDeform(handlesPositionsArr)

  // note that we can now call doDeform() again, and perform even more deformations after this.
  // doDeform() is very cheap, but prepareDeform() is very expensive.

  // now update the deformed mesh:
  for(var i = 0 ; i < targetMesh.positions.length; i+=1) {
    targetMesh.positions[i] = result[i]
  }

  // done using deformation module. so free memory.
  freeModule()

  // regl command for drawing the target mesh.
  var drawMesh = regl({
    vert: `
    precision mediump float;
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec3 color;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vColor;

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
      vec3 color = vColor ;
      vec3 l = normalize(
        eye - vPosition);
      gl_FragColor = vec4(
        0.5*color
          + vec3(0.35)*clamp( dot(vNormal, l), 0.0,1.0 )
        , 1.0);
    }`,

    attributes: {
      position:  targetMesh.positions,
      normal: targetMesh.normals,
      color: targetMesh.colors,
    },

    elements: targetMesh.cells,
    primitive: 'triangles'
  })

  regl.frame(({}) => {
    regl.clear({
      depth: 1,
      color: [1, 1, 1, 1]
    })

    camera(() => {
      drawMesh()
    })
  })
})
