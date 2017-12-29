var cellsHeap
var positionsHeap
var mesh
var roiIndices
var roiStationaryBegin
var roiUnconstrainedBegin

var roiIndicesHeapPtr = null
var handlesPositionsHeapPtr = null
var positionsHeapPtr = null
var cellsHeapPtr =  null

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
  cellsHeapPtr = Module._malloc(nDataBytes)
  cellsHeap = new Uint8Array(Module.HEAPU8.buffer, cellsHeapPtr, nDataBytes);
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
  positionsHeapPtr = Module._malloc(nDataBytes)
  positionsHeap = new Uint8Array(Module.HEAPU8.buffer, positionsHeapPtr, nDataBytes);
  positionsHeap.set(new Uint8Array(positionsArr.buffer));
}

function prepareDeform(
  iRoiHandles, iRoiUnconstrained, iRoiStationary
) {

  roiIndices = []
  var j = 0
  for(const i of iRoiHandles) {
    roiIndices[j++] = i
  }
  roiUnconstrainedBegin = j
  for(const i of iRoiUnconstrained) {
    roiIndices[j++] = i
  }
  roiStationaryBegin = j
  for(const i of iRoiStationary) {
    roiIndices[j++] = i
  }

  var roiIndicesArr = new Int32Array(roiIndices);
  var nDataBytes = roiIndicesArr.length * roiIndicesArr.BYTES_PER_ELEMENT;

  if(roiIndicesHeapPtr !== null) {
    Module._free(roiIndicesHeapPtr)
    roiIndicesHeapPtr = null
  }

  roiIndicesHeapPtr = Module._malloc(nDataBytes)
  var roiIndicesHeap = new Uint8Array(Module.HEAPU8.buffer, roiIndicesHeapPtr, nDataBytes);
  roiIndicesHeap.set(new Uint8Array(roiIndicesArr.buffer));

  prepareDeformWrap(
    cellsHeap.byteOffset, mesh.cells.length*3,

    positionsHeap.byteOffset, mesh.positions.length*3,

    roiIndicesHeap.byteOffset, roiIndices.length,

    roiStationaryBegin, roiUnconstrainedBegin,
    true
  )
}

function doDeform(handlePositions) {
  var nHandlesPositionsArr = roiIndices.length - roiStationaryBegin + roiUnconstrainedBegin

  var handlesPositionsArr = new Float64Array(nHandlesPositionsArr*3);

  var j = 0
  for(var i = 0; i < handlePositions.length; ++i) {
    handlesPositionsArr[j++] = handlePositions[i][0]
    handlesPositionsArr[j++] = handlePositions[i][1]
    handlesPositionsArr[j++] = handlePositions[i][2]
  }

  for(var i = roiStationaryBegin; i < (roiIndices.length); ++i) {
    handlesPositionsArr[j++] = mesh.positions[roiIndices[i]][0]
    handlesPositionsArr[j++] = mesh.positions[roiIndices[i]][1]
    handlesPositionsArr[j++] = mesh.positions[roiIndices[i]][2]
  }
  // deform.

  var nDataBytes = handlesPositionsArr.length * handlesPositionsArr.BYTES_PER_ELEMENT;

  if(handlesPositionsHeapPtr !== null) {
    Module._free(handlesPositionsHeapPtr)
    handlesPositionsHeapPtr = null
  }

  handlesPositionsHeapPtr = Module._malloc(nDataBytes)
  var handlesPositionsHeap = new Uint8Array(Module.HEAPU8.buffer, handlesPositionsHeapPtr, nDataBytes);
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

function freeModule() {
  Module._free(positionsHeapPtr)
  Module._free(cellsHeapPtr)

  if(roiIndicesHeapPtr !== null) {
    Module._free(roiIndicesHeapPtr)
    roiIndicesHeapPtr = null
  }

  if(handlesPositionsHeapPtr !== null) {
    Module._free(handlesPositionsHeapPtr)
    handlesPositionsHeapPtr = null
  }

  freeDeformWrap()

  // TODO: clean up memory allocated by _malloc
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

        Module['onRuntimeInitialized'] = function() {
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

          freeDeformWrap = Module.cwrap(
            'freeDeform', null, [

            ]
          );
          callback(initModule, prepareDeform, doDeform, freeModule)
        }

        script.onload = () => {    // once script has loaded
          resolve(Module);    // return Module
        };
        document.body.appendChild(script); // append script to DOM
      });
  }).then((Module) => {


  })
}
