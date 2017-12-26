var cellsHeap
var positionsHeap
var mesh
// allocate buffers that we can send into webasm
function initModule(iMesh) {
  mesh = iMesh
  var cellsArr = new Int32Array(mesh.cells.length * 3);
  var ia = 0
  for(var ic = 0; ic < mesh.cells.length; ++ic) {
    var c = mesh.cells[ic]
    cellsArr[ia++] = c[0]
    cellsArr[ia++] = c[1]
    cellsArr[ia++] = c[2]
  }
  var nDataBytes = cellsArr.length * cellsArr.BYTES_PER_ELEMENT;
  cellsHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
  cellsHeap.set(new Uint8Array(cellsArr.buffer));

  var positionsArr = new Float64Array(mesh.positions.length * 3);
  var ia = 0
  for(var ic = 0; ic < mesh.positions.length; ++ic) {
    var c = mesh.positions[ic]
    positionsArr[ia++] = c[0]
    positionsArr[ia++] = c[1]
    positionsArr[ia++] = c[2]
  }
  var nDataBytes = positionsArr.length * positionsArr.BYTES_PER_ELEMENT;
  positionsHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
  positionsHeap.set(new Uint8Array(positionsArr.buffer));
}

function prepareDeform(vertices, stationaryBegin, unconstrainedBegin) {
  var roiVertices = new Int32Array(vertices);
  var nDataBytes = roiVertices.length * roiVertices.BYTES_PER_ELEMENT;
  var roiVerticesHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
  roiVerticesHeap.set(new Uint8Array(roiVertices.buffer));

  prepareDeformWrap(
    cellsHeap.byteOffset, mesh.cells.length*3,

    positionsHeap.byteOffset, mesh.positions.length*3,

    roiVerticesHeap.byteOffset, vertices.length,

    stationaryBegin, unconstrainedBegin,
    true
  )
}

function doDeform(handlePositions, roi) {

  var nHandlesPositionsArr = roi.vertices.length - roi.stationaryBegin + roi.unconstrainedBegin

  var handlesPositionsArr = new Float64Array(nHandlesPositionsArr*3);

  var j = 0
  for(var i = 0; i < handlePositions.length; ++i) {
    handlesPositionsArr[j++] = handlePositions[i]
  }

  for(var i = roi.stationaryBegin; i < (roi.vertices.length); ++i) {
    handlesPositionsArr[j++] = mesh.positions[roi.vertices[i]][0]
    handlesPositionsArr[j++] = mesh.positions[roi.vertices[i]][1]
    handlesPositionsArr[j++] = mesh.positions[roi.vertices[i]][2]
  }
  // deform.

  var nDataBytes = handlesPositionsArr.length * handlesPositionsArr.BYTES_PER_ELEMENT;
  var handlesPositionsHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
  handlesPositionsHeap.set(new Uint8Array(handlesPositionsArr.buffer));

  doDeformWrap(
    handlesPositionsHeap.byteOffset, nHandlesPositionsArr,

    positionsHeap.byteOffset
  )

  var result = new Float64Array(positionsHeap.buffer, positionsHeap.byteOffset, mesh.positions.length*3)

  return result
}

module.exports.load = function(callback) {

  Module = {};
  new Promise((resolve) => {
    fetch('out.wasm')    // load the .wasm file
      .then(response => response.arrayBuffer())
      .then((buffer) => {    //return ArrayBuffer
        Module.wasmBinary = buffer;   // assign buffer to Module
        const script = document.createElement('script');
        script.src = 'out.js';   // set script source

        script.onload = () => {    // once script has loaded
          resolve(Module);    // return Module
        };
        document.body.appendChild(script); // append script to DOM
      });
  }).then((Module) => {
    prepareDeformWrap = Module.cwrap(
      'prepareDeform', null, [
        'number', 'number', // cells, nCells

        'number', 'number', // positions, nPositions,

        'number', 'number', // handles, nHandles

        'number', 'number', // stationaryBegin, unconstrainedBegin

        'number',  // ROT_INV
      ]
    );
    doDeformWrap = Module.cwrap(
      'doDeform', null, [
        'number', 'number', // handlePositions, nHandlePositions
        'number', // outPositions
      ]
    );

    callback(initModule, prepareDeform, doDeform)

  })

}
