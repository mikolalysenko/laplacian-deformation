var CSRMatrix = require('csr-matrix')
var cmprecond = require('cuthill-mckee')
var ldl = require('cholesky-solve').prepare
var calcLaplacian = require('./src/laplacian').calcLaplacian
var calcLaplacianReal = require('./src/laplacian').calcLaplacianReal
let li = require("./mylib.js")
var mathjs = require('mathjs')

let EmscriptenMemoryManager = li.EmscriptenMemoryManager
let SparseMatrix = li.SparseMatrix
let DenseMatrix = li.DenseMatrix
let Triplet = li.Triplet

var csrgemtm = require('./src/csrgemtm')

var qrSolve = require('qr-solve')
//var qrSolve = require('./lol3.js')
function transpose (positions) {
  var x = new Float64Array(positions.length)
  var y = new Float64Array(positions.length)
  var z = new Float64Array(positions.length)
  for (var i = 0; i < positions.length; ++i) {
    var p = positions[i]
    x[i] = p[0]
    y[i] = p[1]
    z[i] = p[2]
  }
  return [x, y, z]
}

function comparePair (a, b) {
  return a[0] - b[0] || a[1] - b[1]
}

// sparse matrix coeffs are in the argument.
function augmentMatrix(coeffsReal, handlesObj, N, M, handlesMap) {

  // add handles.
  var P = handlesObj.handles.length
  for (var i = 0; i < handlesObj.afterHandles; ++i) {
    coeffsReal.push([i*3 + N + 0, handlesMap[handlesObj.handles[i]] + 0 * P, 1])
    coeffsReal.push([i*3 + N + 1, handlesMap[handlesObj.handles[i]] + 1 * P, 1])
    coeffsReal.push([i*3 + N + 2, handlesMap[handlesObj.handles[i]] + 2 * P, 1])
  }

  // add stationary.
  for (var i = handlesObj.afterHandlesMore; i < handlesObj.handles.length; ++i) {
    coeffsReal.push([(i-handlesObj.afterHandlesMore)*3 + N + 0 + handlesObj.afterHandles*3, handlesMap[handlesObj.handles[i]] + 0 * P, 1])
    coeffsReal.push([(i-handlesObj.afterHandlesMore)*3 + N + 1 + handlesObj.afterHandles*3, handlesMap[handlesObj.handles[i]] + 1 * P, 1])
    coeffsReal.push([(i-handlesObj.afterHandlesMore)*3 + N + 2 + handlesObj.afterHandles*3, handlesMap[handlesObj.handles[i]] + 2 * P, 1])
  }

  // this thing, times x(our desired solution) should be b.
  var augMat = CSRMatrix.fromList(coeffsReal, M, N)

  var coeffsRealTrans = []
  for(var i = 0; i < coeffsReal.length; ++i) {
    var e = coeffsReal[i]
    coeffsRealTrans.push([e[1], e[0], e[2]])
  }
  coeffsRealTrans.sort(comparePair)

  var augMatTrans = CSRMatrix.fromList(coeffsRealTrans, N, M)

  // calculate square matrix
  var mmt = csrgemtm(augMatTrans, augMatTrans)

  let T = new Triplet(N, N)
  for(var i = 0; i < mmt.length; ++i) {
    var e = mmt[i]
    T.addEntry(e[2], e[0], e[1])
  }
  let spars = SparseMatrix.fromTriplet(T)
  let llt = spars.chol()
  return [llt, augMatTrans]
}

module.exports = function (cells, positions, handlesObj) {
  var ROT_INV = true // rotation invariant algorithm


  var N = handlesObj.handles.length*3

  var numHandles = handlesObj.afterHandles - 0
  var numStationary = handlesObj.handles.length - handlesObj.afterHandlesMore

  var M = N + (numHandles + numStationary)*3

  var trace = new Float64Array(N)

  var handlesMap = {}
  var invHandlesMap = {}
  for(var i = 0; i < handlesObj.handles.length; ++i) {
    // map from 1803,1402 to 0,1
    handlesMap[handlesObj.handles[i]] = i

    // map from 0,1 to 1803,1402
    invHandlesMap[i] = handlesObj.handles[i]


  }

  var ha = handlesObj.handles

  var adj = []
  for(var i = 0; i < ha.length; ++i) {
    adj[handlesMap[ha[i]]] = []
  }

  for(var i = 0; i < cells.length; ++i) {
    var c = cells[i]
    for(var j = 0; j < 3; ++j) {
      var a = handlesMap[c[j+0]]
      var b = handlesMap[c[(j+1) % 3]]
      if(a !== undefined && b !== undefined) {
        adj[a].push(b)
      }
    }
  }


  var coeffs = calcLaplacian(cells, positions, trace, handlesObj, handlesMap, adj)

  var lapMat = CSRMatrix.fromList(coeffs, N, N)

  var flattened = new Float64Array(N)
  var c = 0

  for (var d = 0; d < 3; ++d) {
    for (var i = 0; i < handlesObj.handles.length; ++i) {
      flattened[c++] = positions[handlesObj.handles[i]][d]
    }
  }

  var delta = lapMat.apply(flattened, new Float64Array(N))

  // all right, got the delta coords. now use the delta coords to calculate the REAL matrix!
  var coeffsReal
  var Ts
  if(ROT_INV) {
    var a = calcLaplacianReal(cells, positions, trace, delta, handlesObj, invHandlesMap, handlesMap, adj)
    Ts = a[0]
    coeffsReal = a[1]
  } else {
    coeffsReal = coeffs
  }

  var a = augmentMatrix(coeffsReal, handlesObj, N, M, handlesMap)
  var llt = a[0]
  var augMatTrans = a[1]


  var b = new Float64Array(M)
  var x = new Float64Array(N)
  var y = new Float64Array(N)

  var out = new Float64Array(N)
  var z= DenseMatrix.zeros(N)

  return function (handlePositions, outPositions) {
    var count = 0

    for(var i = 0; i < delta.length; ++i) {
      if(ROT_INV) {
        b[count++] = 0
      } else {
        b[count++] = delta[i]
      }
    }

    for (var j = 0; j < handlePositions.length; ++j) {
      b[count++] = handlePositions[j][0]
      b[count++] = handlePositions[j][1]
      b[count++] = handlePositions[j][2]
    }

    // multiply left side by augmatTrans.
    augMatTrans.apply(b, y)

    //solve(b, x)
    for(var i = 0; i < y.length; ++i) {
      z.set(y[i], i, 0)
    }

    var ret = llt.solvePositiveDefinite(z)

    for (var d = 0; d < 3; ++d) {
      for (var i = 0; i < handlesObj.handles.length; ++i) {
        //    console.log("before: ", i, positions[invHandlesMap[i]][d])
        //        console.log("after: ", i, ret.get(i + d*P, 0))

        positions[invHandlesMap[i]][d] = ret.get(i + d*(N/3), 0)
      }
    }

    if(ROT_INV) {
      for(var i = 0; i < handlesObj.afterHandlesMore; ++i) {
        // compute transform T_i

        // set of {i} and N
        var inset = []
        inset.push(i)
        for(var j = 0; j < adj[i].length; ++j) {
          inset.push(adj[i][j])
        }

        var v = []
        for(var j = 0; j < inset.length; ++j) {
          v.push(positions[invHandlesMap[inset[j]]][0])
          v.push(positions[invHandlesMap[inset[j]]][1])
          v.push(positions[invHandlesMap[inset[j]]][2])

        }

        var prod = mathjs.multiply(Ts[i], v)

        //      console.log("prod: ", prod)
      }
    }

    return out

  }
}



/*
  first, see if we actually have a solution.

  compute condition number of matrix.

  then, switch to better mesh.
*/
