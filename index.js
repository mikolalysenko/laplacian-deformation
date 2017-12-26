var cellsHeap
var positionsHeap
var mesh
var roiVertices
var roiStationaryBegin
var roiUnconstrainedBegin
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

function prepareDeform(iRoiVertices, iRoiStationaryBegin, iRoiUnconstrainedBegin) {
  roiVertices = iRoiVertices
  roiStationaryBegin = iRoiStationaryBegin
  roiUnconstrainedBegin = iRoiUnconstrainedBegin

  var roiVerticesArr = new Int32Array(roiVertices);
  var nDataBytes = roiVerticesArr.length * roiVerticesArr.BYTES_PER_ELEMENT;
  var roiVerticesHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
  roiVerticesHeap.set(new Uint8Array(roiVerticesArr.buffer));

  prepareDeformWrap(
    cellsHeap.byteOffset, mesh.cells.length*3,

    positionsHeap.byteOffset, mesh.positions.length*3,

    roiVerticesHeap.byteOffset, roiVertices.length,

    roiStationaryBegin, roiUnconstrainedBegin,
    true
  )
}

function doDeform(handlePositions) {
  var nHandlesPositionsArr = roiVertices.length - roiStationaryBegin + roiUnconstrainedBegin

  var handlesPositionsArr = new Float64Array(nHandlesPositionsArr*3);

  var j = 0
  for(var i = 0; i < handlePositions.length; ++i) {
    handlesPositionsArr[j++] = handlePositions[i][0]
    handlesPositionsArr[j++] = handlePositions[i][1]
    handlesPositionsArr[j++] = handlePositions[i][2]
  }

  for(var i = roiStationaryBegin; i < (roiVertices.length); ++i) {
    handlesPositionsArr[j++] = mesh.positions[roiVertices[i]][0]
    handlesPositionsArr[j++] = mesh.positions[roiVertices[i]][1]
    handlesPositionsArr[j++] = mesh.positions[roiVertices[i]][2]
  }
  // deform.

  var nDataBytes = handlesPositionsArr.length * handlesPositionsArr.BYTES_PER_ELEMENT;
  var handlesPositionsHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
  handlesPositionsHeap.set(new Uint8Array(handlesPositionsArr.buffer));

  doDeformWrap(
    handlesPositionsHeap.byteOffset, nHandlesPositionsArr,

    positionsHeap.byteOffset
  )

  var temp = new Float64Array(positionsHeap.buffer, positionsHeap.byteOffset, mesh.positions.length*3)

  var result = []
  for(var i = 0; i < mesh.positions.length; ++i) {
    result[i] = [temp[3*i + 0], temp[3*i + 1], temp[3*i + 2]]
  }

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
