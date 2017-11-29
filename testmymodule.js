var Module = require('./out.js')

testfunction = Module.cwrap(
  'testfunction', 'number', ['number', 'number']
);

// Create example data to test float_multiply_array
var data = new Float32Array([1, 2, 3, 4, 5]);

var nDataBytes = data.length * data.BYTES_PER_ELEMENT;
var dataHeap = new Uint8Array(Module.HEAPU8.buffer, Module._malloc(nDataBytes), nDataBytes);
dataHeap.set(new Uint8Array(data.buffer));

testfunction(dataHeap.byteOffset, data.length);
//var result = new Float32Array(dataHeap.buffer, dataHeap.byteOffset, data.length);
