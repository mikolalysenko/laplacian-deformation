var CSRMatrix = require('csr-matrix')
var cmprecond = require('cuthill-mckee')
var ldl = require('cholesky-solve').prepare
var calcLaplacian = require('./src/laplacian').calcLaplacian
var calcLaplacianReal = require('./src/laplacian').calcLaplacianReal
let li = require("./mylib.js")

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

module.exports = function (cells, positions, handlesObj) {
  var N = handlesObj.handles.length*3

  var numHandles = handlesObj.afterHandles - 0
  var numStationary = handlesObj.handles.length - handlesObj.afterHandlesMore

  var M = N + (numHandles + numStationary)*3

  var trace = new Float64Array(N)

  var handlesMap = {}
  var invHandlesMap = {}
  for(var i = 0; i < handlesObj.handles.length; ++i) {
    handlesMap[handlesObj.handles[i]] = i
    invHandlesMap[i] = handlesObj.handles[i]
  }

  var coeffs = calcLaplacian(cells, positions, trace, handlesObj, handlesMap)

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
  var coeffsReal = calcLaplacianReal(cells, positions, trace, delta, handlesObj, invHandlesMap, handlesMap)

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

  var b = new Float64Array(M)
  var x = new Float64Array(N)
  var y = new Float64Array(N)

  var out = new Float64Array(N)
  var z= DenseMatrix.zeros(N)

  return function (handlePositions, outPositions) {


    /*

  var testing = new Float64Array(M)
  var testing2 = new Float64Array(N)

  var mmtMat = CSRMatrix.fromList(mmt, N, N)

    augMat.apply(flattened, testing)

    for(var i = 0; i < handlePositions.length; ++i) {

      var d

      d = Math.abs(testing[i*3 + 0 +  3* (handlesObj.handles.size) ] - handlePositions[i][0])
      if(d > 0.00001) {
        console.log("x wrong diff at diff: ", i, "diff is ", d)
      }


      d = Math.abs(testing[i*3 + 1 +  3* (handlesObj.handles.size) ] - handlePositions[i][1])
      if(d > 0.00001) {
        console.log("y wrong diff at diff: ", i, "diff is ", d)
      }

      d = Math.abs(testing[i*3 + 2 +  3* (handlesObj.handles.size) ] - handlePositions[i][2])
      if(d > 0.00001) {
        console.log("y wrong diff at diff: ", i, "diff is ", d)
      }
    }

    mmtMat.apply(flattened, testing2)

    for(var i = 0; i < testing2.length; ++i) {

      var d = Math.abs(testing2[i] - y[i])
      if(d > 0.00001) {
      console.log("diff: ", d)
      }
    }

    */

    var count = 0

    for(var i = 0; i < delta.length; ++i) {
      b[count++] = 0
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

        positions[invHandlesMap[i]][d] = ret.get(i + d*P, 0)
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
