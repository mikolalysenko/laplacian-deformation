var CSRMatrix = require('csr-matrix')
var cmprecond = require('cuthill-mckee')
var ldl = require('cholesky-solve').prepare
var calcLaplacian = require('./src/laplacian')
var csrgemtm = require('./src/csrgemtm')
var qrSolve = require('qr-solve')

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

module.exports = function (cells, positions, handleIds) {
  var N = positions.length
  var M = N + handleIds.length

  var trace = new Float64Array(N)

  var coeffs = calcLaplacian(cells, trace)
  var lapMat = CSRMatrix.fromList(coeffs, N, N)


  // calculate position derivatives
  var tpositions = transpose(positions)
  var delta = [
    lapMat.apply(tpositions[0], new Float64Array(N)),
    lapMat.apply(tpositions[1], new Float64Array(N)),
    lapMat.apply(tpositions[2], new Float64Array(N))
  ]

  // augment matrix
  for (var i = 0; i < handleIds.length; ++i) {
    coeffs.push([i + N, handleIds[i], 1])
  }
  var augMat = CSRMatrix.fromList(coeffs, M, N)

  /*
  // calculate square matrix
//  var mmt = csrgemtm(augMat, augMat)
  // calculate preconditioner
  var pi = cmprecond(mmt, N)
  */

  // precalculate solver
  var solve = qrSolve.prepare(coeffs, M, N)

  var b = new Float64Array(M)
  var x = new Float64Array(N)
  var out = new Float64Array(3 * N)

  return function (handlePositions) {

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

    return out
  }
}
