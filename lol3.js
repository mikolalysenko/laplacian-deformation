Module = require("./a.out.js")
//Module.TOTAL_MEMORY = 1 << 26
decomposewrap = Module.cwrap('decompose', null,

                         ['number', 'number',

                          'number','number','number',

                          'number','number','number',
                          'number','number','number',

                         ]
                        )

solvewrap = Module.cwrap('solve', null,

                     [
                       'number','number',

                       'number','number','number',
                       'number','number','number',

                       'number','number',


                     ]
                    )

function _arrayToHeap(typedArray){
  var numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
  var ptr = Module._malloc(numBytes);
  var heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
  heapBytes.set(new Uint8Array(typedArray.buffer));
  return heapBytes
}

module.exports.prepare = function(As, m, n) {
  var A = {
    row_start: [],
    column_index: [],
    value: [],
  }

  for(var i = 0; i < As.length; ++i) {
    var e = As[i]

    if(i == 0 || As[i][0] != As[i-1][0]) {
      A.row_start.push(i)
    }

    A.column_index.push(e[1])
    A.value.push(e[2])
  }
  A.row_start[A.row_start.length] = As.length

  var A_row_start = _arrayToHeap(new Int32Array(A.row_start));
  var A_column_index = _arrayToHeap(new Int32Array(A.column_index));
  var A_value = _arrayToHeap(new Float64Array(A.value));

  var s = []
  for(var i = 0; i < n; ++i) {
    s[i] = 0
  }
  var solution = _arrayToHeap(new Float64Array(s));

  var solutionBuf = new ArrayBuffer(8 * n);
  var solutionView = new DataView(solutionBuf);

  var bBuf = new ArrayBuffer(8 * m)
  var bView = new DataView(bBuf);

  // allocate double pointers to Q and R.
  ptr_Q_row_start =  _arrayToHeap(new Int32Array([0]))
  ptr_Q_column_index = _arrayToHeap(new Int32Array([0]))
  ptr_Q_value = _arrayToHeap(new Int32Array([0]))
  ptr_R_row_start = _arrayToHeap(new Int32Array([0]))
  ptr_R_column_index = _arrayToHeap(new Int32Array([0]))
  ptr_R_value = _arrayToHeap(new Int32Array([0]))

  decomposewrap(m, n, A_row_start.byteOffset, A_column_index.byteOffset, A_value.byteOffset,
            ptr_Q_row_start.byteOffset,
            ptr_Q_column_index.byteOffset,
            ptr_Q_value.byteOffset,
            ptr_R_row_start.byteOffset,
            ptr_R_column_index.byteOffset,
            ptr_R_value.byteOffset)

  // convert a double pointer to a normal pointer.
  function toPtr(a) {
    return (a[3] << 24) | (a[2] << 16) | (a[1] << 8) | (a[0] << 0)
  }

  var b = _arrayToHeap(new Float64Array(m))

  return function(bIn, solutionOut) {

    for(var i = 0; i < m; ++i) {
      bView.setFloat64(i*8, bIn[i], true);
    }

    for(var i = 0; i < m*8; ++i) {
      b[i] = bView.getUint8(i, true);
    }

    solvewrap(m, n, toPtr(ptr_Q_row_start), toPtr(ptr_Q_column_index), toPtr(ptr_Q_value),
          toPtr(ptr_R_row_start), toPtr(ptr_R_column_index), toPtr(ptr_R_value),
          b.byteOffset, solution.byteOffset)

    for(var i = 0; i < n*8; ++i) {
      solutionView.setUint8(i, solution[i], true);
    }

    for(var i = 0; i < n; ++i) {
      solutionOut[i] = solutionView.getFloat64(i * 8, true);
    }

  }

}

/*
var A = [
  [0, 0, +1],
  [0, 1, -1],
  [0, 2, +4],

  [1, 0, +1],
  [1, 1, +4],
  [1, 2, -2],

  [2, 0, +1],
  [2, 1, +4],
  [2, 2, +2],

  [3, 0, +1],
  [3, 1, -1]
]

var m = 4
var n = 3
var b = [11, 3, 15, -1]
*/



/*

var A = [
  [0, 0, +1.70],
  [0, 8, +0.13],

  [1, 1, +1.00],
  [1, 4, +0.02],
  [1, 9, +0.01],

  [2, 2, +1.50],

  [3, 3, +1.10],

  [4, 1, +0.02],
  [4, 4, +2.60],
  [4, 6, +0.16],
  [4, 7, +0.09],
  [4, 8, +0.52],
  [4, 9, +0.53],

  [5, 5, +1.20],

  [6, 4, +0.16],
  [6, 6, +1.30],
  [6, 9, +0.56],

  [7, 4, +0.09],
  [7, 7, +1.60],
  [7, 8, +0.11],

  [8, 0, +0.13],
  [8, 4, +0.52],
  [8, 7, +0.11],
  [8, 8, +1.40],

  [9, 1, +0.01],
  [9, 4, +0.53],
  [9, 6, +0.56],
  [9, 9, +3.10],
]

var b =  [0.287, 0.22, 0.45, 0.44, 2.486, 0.72, 1.55, 1.424, 1.621, 3.759]

var m = 10
var n = 10

var solve = module.exports.prepare(A, m, n) // first decompose.
var solution = new Float64Array(n)
solve(b, solution)
console.log(solution)

*/
