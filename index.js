var CSRMatrix = require('csr-matrix')
var cmprecond = require('cuthill-mckee')
var ldl = require('cholesky-solve').prepare
var calcLaplacian = require('./src/laplacian')
var csrgemtm = require('./src/csrgemtm')

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
  var coeffs = calcLaplacian(cells, positions)
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
    coeffs.push([handleIds[i], i + N, 1])
  }
  var augMat = CSRMatrix.fromList(coeffs, N, M)

  // calculate square matrix
  var mmt = csrgemtm(augMat, augMat)

  var pi = cmprecond(mmt, N)
  var solve = ldl(mmt, N, pi)

  var b = new Float64Array(M)
  var y = new Float64Array(N)

  return function (handlePositions, _out) {
    var out = _out || new Float64Array(3 * N)

    for (var d = 0; d < 3; ++d) {
      var lp = delta[d]
      for (var i = 0; i < N; ++i) {
        b[i] = lp[i]
      }
      for (var j = 0; j < handlePositions.length; ++j) {
        b[j + N] = handlePositions[j][d]
      }
      var x = solve(augMat.apply(b, y))
      for (var k = 0; k < N; ++k) {
        out[3 * k + d] = x[k]
      }
    }

    return out
  }
}
