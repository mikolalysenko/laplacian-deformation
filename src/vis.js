const normals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
var control = require('control-panel')
//var bunny = require('stanford-dragon/2')
var bunny = require('../meshes/Armadillo.json')
//var bunny = require('../meshes/bunny.json')

//var bunny = require('bunny')

//console.log(bunny)
console.log(bunny)

var rayTriIntersect = require('ray-triangle-intersection');

const fit = require('canvas-fit')
var cameraPosFromViewMatrix   = require('gl-camera-pos-from-view-matrix');
//var Module = require('../out2.js')

const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')({canvas: canvas, extensions: ['oes_texture_float']})

var str = `<a href="https://github.com/mikolalysenko/laplacian-deformation"><img style="position: absolute; top: 0; left: 0; border: 0;" src="https://camo.githubusercontent.com/82b228a3648bf44fc1163ef44c62fcc60081495e/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f6c6566745f7265645f6161303030302e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_left_red_aa0000.png"></a>`


    Module = {};
loadWASM = () => {
  return new Promise((resolve) => {
    fetch('out.wasm')    // load the .wasm file
      .then(response => response.arrayBuffer())
      .then((buffer) => {    //return ArrayBuffer
        Module.wasmBinary = buffer;   // assign buffer to Module

        const script = document.createElement('script');
        script.src = 'out.js';   // set script source

        script.onload = () => {    // once script has loaded
          console.log("Loaded Emscripten.");
          resolve(Module);    // return Module
        };
        document.body.appendChild(script); // append script to DOM
      });
  });
};

loadWASM().then((Module) => {

  prepareDeform = Module.cwrap(
    'prepareDeform', null, [
      'number', 'number', // cells, nCells

      'number', 'number', // positions, nPositions,

      'number', 'number', // handles, nHandles

      'number', 'number', // stationaryBegin, unconstrainedBegin

      'number',  // ROT_INV
    ]
  );

  doDeformLib = Module.cwrap(
    'doDeform', null, [
      'number', 'number', // handlePositions, nHandlePositions
      'number', // outPositions
    ]
  );

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



  var cellsArr = new Int32Array(bunny.cells.length * 3);
  var ia = 0
  for(var ic = 0; ic < bunny.cells.length; ++ic) {
    var c = bunny.cells[ic]
    cellsArr[ia++] = c[0]
    cellsArr[ia++] = c[1]
    cellsArr[ia++] = c[2]
  }
  var nDataBytes = cellsArr.length * cellsArr.BYTES_PER_ELEMENT;
  var cellsHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
  cellsHeap.set(new Uint8Array(cellsArr.buffer));

  var positionsArr = new Float64Array(bunny.positions.length * 3);
  var ia = 0
  for(var ic = 0; ic < bunny.positions.length; ++ic) {
    var c = bunny.positions[ic]
    positionsArr[ia++] = c[0]
    positionsArr[ia++] = c[1]
    positionsArr[ia++] = c[2]
  }
  var nDataBytes = positionsArr.length * positionsArr.BYTES_PER_ELEMENT;
  var positionsHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
  positionsHeap.set(new Uint8Array(positionsArr.buffer));



  console.log("position buffe len: ", bunny.positions.length * 3 * 4)
  /*
    Create command for drawing bunny.
  */
  const positionBuffer = regl.buffer({
    length: bunny.positions.length * 3 * 4,
    type: 'float',
    usage: 'dynamic'
  })

  const colorBuffer = regl.buffer({
    length: bunny.positions.length * 3 * 4,
    type: 'float',
    usage: 'dynamic'
  })

  var bunnyNormals = normals(bunny.cells, bunny.positions)

  var bunnyIds = []
  for(var i = 0; i < bunny.positions.length; ++i) {
    bunnyIds[i] = i + 0.0
  }

  var handlesObj = {
    handles: []
  }

  var prevPos = null
  var prevMousePos = null
  function selectHandle(mainHandle) {
    var currentRing = [mainHandle]

    prevPos = null
    prevMousePos = null
    var visited = []
    for(var i = 0; i < bunny.positions.length; ++i) {
      visited[i] = false
    }

    handlesObj.handles = []

    var unconstrainedSet = []
    var handlesSet = []

    for(var i = 0; i < bunny.positions.length; ++i) {
      unconstrainedSet[i] = false
      handlesSet[i] = false
    }

    // FIRST HANDLES.
    while(handlesObj.handles.length < 300) {

      var nextRing = []

      for(var i = 0; i < currentRing.length; ++i) {
        var e = currentRing[i]

        if(visited[e])
          continue

        handlesObj.handles.push(e)
        visited[e] = true
        handlesSet[e] = true

        var adjs = adj[e]

        for(var j = 0; j < adjs.length; ++j) {
          nextRing.push(adjs[j])
        }
      }
      currentRing = nextRing
    }
    handlesObj.unconstrainedBegin = handlesObj.handles.length


    // 800
    while(handlesObj.handles.length < 3000) {

      var nextRing = []

      for(var i = 0; i < currentRing.length; ++i) {
        var e = currentRing[i]

        if(visited[e])
          continue

        handlesObj.handles.push(e)
        visited[e] = true
        unconstrainedSet[e] = true


        var adjs = adj[e]
        for(var j = 0; j < adjs.length; ++j) {
          nextRing.push(adjs[j])
        }
      }
      currentRing = nextRing
    }

    handlesObj.stationaryBegin = handlesObj.handles.length

    var staticVertices = []
    for(var i = 0; i < currentRing.length; ++i) {
      var e = currentRing[i]

      if(visited[e])
        continue

      staticVertices.push(e)
      handlesObj.handles.push(e)

      visited[e] = true
    }

    /*
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

      for(var i = 0; i < bunny.positions.length; ++i) {
      if(!(stationarySet[i] === true || handlesSet[i] === true)) {
      unconstrained.push(i)
      }
      }


      // copy of the mesh, that we use when restoring the mesh.
      var copyBunny = JSON.parse(JSON.stringify(bunny))


      var handlesObj = {
      handles: []
      }

      for(var i = 0; i < handles.length; ++i) {
      handlesObj.handles.push(handles[i])
      }
      handlesObj.unconstrainedBegin = handlesObj.handles.length

      for(var i = 0; i < unconstrained.length; ++i) {
      handlesObj.handles.push(unconstrained[i])
      }
      handlesObj.stationaryBegin = handlesObj.handles.length

      for(var i = 0; i < stationary.length; ++i) {
      handlesObj.handles.push(stationary[i])
      }
    */

    var handlesArr = new Int32Array(handlesObj.handles);
    var nDataBytes = handlesArr.length * handlesArr.BYTES_PER_ELEMENT;
    var handlesHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
    handlesHeap.set(new Uint8Array(handlesArr.buffer));

    var bunnyColors = []

    for(var i = 0; i < bunnyNormals.length; ++i) {
      bunnyColors[i] = [0.4, 0.4, 0.4];

      if(handlesSet[i] === true) {
        bunnyColors[i] = [0.3, 0.3, 0.0];
      } else if(unconstrainedSet[i] === true) {
        bunnyColors[i] = [0.0, 0.0, 0.3];
      } else {
        bunnyColors[i] = [0.0, 0.0, 0.0];
      }
    }
    colorBuffer.subdata(bunnyColors)

    prepareDeform(
      cellsHeap.byteOffset, bunny.cells.length*3,

      positionsHeap.byteOffset, bunny.positions.length*3,

      handlesHeap.byteOffset, handlesObj.handles.length,

      handlesObj.stationaryBegin, handlesObj.unconstrainedBegin,
      //      true
      true
    )

  }

  //  var dragTarget = 2234
  var dragTarget = 2096

  selectHandle(dragTarget)

  //  selectHandle(200)

  //testfunction(dataHeap.byteOffset, data.length);

  // set current handle that we're manipulating.

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
      //      bunny = JSON.parse(JSON.stringify(copyBunny))

      //var handlesObj = handlesObj
      //doDeform([+0.0, 0.2, 0.0])
      //positionBuffer.subdata(bunny.positions)
      selectHandle(200)

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

      vec3 color = vColor + vec3(0.0, 0.0, 0.4);

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

      color: {
        buffer: colorBuffer,
        normalized: true
      },

    },

    elements: bunny.cells,
    primitive: 'triangles'
  })



  function doDeform(offset) {

    var numHandles = handlesObj.unconstrainedBegin - 0
    var numStationary = handlesObj.handles.length - handlesObj.stationaryBegin

    if(!handlesObj)
      return

    var nHandlesPositionsArr = numHandles + numStationary

    var handlesPositionsArr = new Float64Array(nHandlesPositionsArr*3);

    var j = 0
    for(var i = 0; i < (handlesObj.unconstrainedBegin); ++i) {
      handlesPositionsArr[j++] = bunny.positions[handlesObj.handles[i]][0]  + offset[0]
      handlesPositionsArr[j++] = bunny.positions[handlesObj.handles[i]][1]  + offset[1]
      handlesPositionsArr[j++] = bunny.positions[handlesObj.handles[i]][2]  + offset[2]
    }

    for(var i = handlesObj.stationaryBegin; i < (handlesObj.handles.length); ++i) {
      handlesPositionsArr[j++] = bunny.positions[handlesObj.handles[i]][0]
      handlesPositionsArr[j++] = bunny.positions[handlesObj.handles[i]][1]
      handlesPositionsArr[j++] = bunny.positions[handlesObj.handles[i]][2]
    }
    // deform.
    //var d = handlesObj.doDeform(arr, bunny.positions)

    var nDataBytes = handlesPositionsArr.length * handlesPositionsArr.BYTES_PER_ELEMENT;
    var handlesPositionsHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
    handlesPositionsHeap.set(new Uint8Array(handlesPositionsArr.buffer));

    doDeformLib(
      handlesPositionsHeap.byteOffset, nHandlesPositionsArr,

      positionsHeap.byteOffset
    )

    var result = new Float64Array(positionsHeap.buffer, positionsHeap.byteOffset, bunny.positions.length*3)

    for(var i = 0 ; i < bunny.positions.length; i+=1) {
      bunny.positions[i][0] = result[3*i + 0]
      bunny.positions[i][1] = result[3*i + 1]
      bunny.positions[i][2] = result[3*i + 2]

    }

    positionBuffer.subdata(bunny.positions)
  }
  doDeform([+0.0, +0.0, 0.0])
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
  var isPicking = false

  var movecamera = false

  window.onkeydown = function(e) {
    var key = e.keyCode ? e.keyCode : e.which;

    if (key == 84) { // t
      isPicking = true
    }

    if (key == 81) { // q
      movecamera = true
      isDragging = false
    }
    if (key == 87) { // w
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
    if (key == 84) {
      isPicking = false
    }
  }


  canvas.addEventListener('mousedown', mousedown, false)

  /*
    When clicking mouse, pick handle that is near enough to mouse, and closest to the camera.
  */
  function mousedown() {
    if(isPicking) {
      console.log("CLICK")

      var ret = getCameraRay()
      var d = ret[0]
      var o = ret[1]

      for(var i = 0; i < bunny.cells.length; ++i) {
        var c = bunny.cells[i]

        var p0 = bunny.positions[c[0]]
        var p1 = bunny.positions[c[1]]
        var p2 = bunny.positions[c[2]]

        if(rayTriIntersect([], o, d, [p0, p1, p2]) != null) {
          //          console.log("INTERSECT")
          selectHandle(c[0])
          console.log("myand", c[0])
          // 2234
          dragTarget = c[0]
          break
        }

      }

    }

    if(!isPicking && !movecamera) {
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


      if(handlesObj != null) {
        for(var i = 0; i < handlesObj.handles.length; ++i) {
          //      if(i != 3) continue
          var handle = bunny.positions[handlesObj.handles[i]]

          var c = [0.5, 0.5, 0.5]

          if(i >= handlesObj.stationaryBegin) {
            c = [1.0, 0.0, 0.0]
          } else if(i >= handlesObj.unconstrainedBegin){
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

      var pr0 = bunny.positions[dragTarget]
      var pn = [o[0] - pr0[0], o[1] - pr0[1], o[2] - pr0[2]]

      vec3.normalize(pn, pn)

      var t = (vec3.dot(pn, pr0) - vec3.dot(pn, o)) / vec3.dot(d, pn)

      var p = vec3.add([], o, vec3.scale([], d, t))

      if(prevPos != null && prevMousePos != null) {

        var diff = vec3.subtract([],
                                 [mousePos[0], mousePos[1], 0],
                                 [prevMousePos[0], prevMousePos[1], 0])

        console.log("is dragging! ", diff)

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
})
