var CSRMatrix = require('csr-matrix')
var cmprecond = require('cuthill-mckee')
var ldl = require('cholesky-solve').prepare
var calcLaplacian = require('./src/laplacian').calcLaplacian
var calcLaplacianReal = require('./src/laplacian').calcLaplacianReal

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


module.exports = function (cells, positions, handleIds) {
  var N = positions.length*3
  var M = N + handleIds.length*3

  var trace = new Float64Array(N)

  var coeffs = calcLaplacian(cells, positions, trace)
  //  console.log("coeffs: ", coeffs)
  console.log("real: ", coeffs)


  var lapMat = CSRMatrix.fromList(coeffs, N, N)

//  console.log("lapmat: ", (lapMat) )


  // calculate position derivatives
 /* var tpositions = transpose(positions)
  var delta = [
    lapMat.apply(tpositions[0], new Float64Array(N)),
    lapMat.apply(tpositions[1], new Float64Array(N)),
    lapMat.apply(tpositions[2], new Float64Array(N))
  ]
 */

  var flattened = new Float64Array(N)
  var c = 0

  for (var d = 0; d < 3; ++d) {
    for (var i = 0; i < positions.length; ++i) {
      flattened[c++] = positions[i][d]
    }
  }

  var delta = lapMat.apply(flattened, new Float64Array(N))


  // all right, got the delta coords. now use the delta coords to calculate the REAL matrix!
  var coeffsReal = calcLaplacianReal(cells, positions, trace, delta)
/*
  for(var i = 0; i < coeffsReal.length; ++i) {

  }
  */

  console.log("eric: ", coeffsReal)

  // augment matrix
  var P = positions.length
  for (var i = 0; i < handleIds.length; ++i) {
    coeffsReal.push([i*3 + N + 0, handleIds[i] + 0 * P, 1])
    coeffsReal.push([i*3 + N + 1, handleIds[i] + 1 * P, 1])
    coeffsReal.push([i*3 + N + 2, handleIds[i] + 2 * P, 1])
  }
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
  // calculate preconditioner
  var pi = cmprecond(mmt, N)

  var solve = ldl(mmt, N)

  // precalculate solver
  //  var solve = qrSolve.prepare(coeffsReal, M, N)


  var b = new Float64Array(M)
  var x = new Float64Array(N)
  var y = new Float64Array(M)

  var out = new Float64Array(N)

  return function (handlePositions) {

    var count = 0

    /*
    for (var d = 0; d < 3; ++d) {
      var lp = delta[d]
      for (var i = 0; i < N/3; ++i) {
        b[count++] = lp[i]
      }
    }
    */
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
    var x = solve(y)

    for (var d = 0; d < 3; ++d) {
      for (var i = 0; i < positions.length; ++i) {
        out[i * 3 + d] = x[i + d * P]
      }
    }
    /*
    for (var k = 0; k < N; ++k) {
      out[3 * k + d] = x[k]
    }
    */

    /*
    for (var d = 0; d < 3; ++d) {
      var lp = delta[d]
      for (var i = 0; i < N; ++i) {
        b[i] = lp[i]
      }
      for (var j = 0; j < handlePositions.length; ++j) {
        b[j + N] = handlePositions[j][d]
      }
      // use conjugate gradient.
      solve(b, x)

      for (var k = 0; k < N; ++k) {
        out[3 * k + d] = x[k]
      }
    }
    */

    return out
  }
}
