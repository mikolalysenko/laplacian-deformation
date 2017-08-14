var bits = require("bit-twiddle")
  , almostEqual = require("almost-equal")
var qrSolve = require("qr-solve")
var R = new Float64Array(1024)
var P = new Float64Array(1024)
var D = new Float64Array(1024)
var Z = new Float64Array(1024)
var U = new Float64Array(1024)

function reserve(n) {
  if(n < R.length) {
    return
  }
  var nsize = bits.nextPow2(n)
  R = new Float64Array(nsize)
  P = new Float64Array(nsize)
  Z = new Float64Array(nsize)
  D = new Float64Array(nsize)
  U = new Float64Array(nsize)
}

function norm2(p) {
  var s = 0.0
  for(var i = 0; i < p.length; ++i) {
    s += p[i] * p[i]
  }
  return s
}

function conjugateGradient(A, b, x, tolerance, max_iter) {
  var abs = Math.abs
    , max = Math.max
    , EPSILON = almostEqual.FLT_EPSILON
    , n = A.rowCount
    , i, j, k
    , alpha_n, alpha_d, alpha, beta, rnorm, s
  if(!tolerance) {
    tolerance = 1e-5
  }
  if(!max_iter) {
    max_iter = Math.min(n, 20)
  }
  if(!x) {
    if(b.buffer) {
      x = new b.constructor(b.buffer.slice(0))
    } else {
      x = b.slice(0)
    }
  }
  reserve(n)
  //Compute preconditioner
  /*
  for(i=0; i<n; ++i) {
    s = A.get(i, i)
    if(abs(s) > EPSILON) {
      D[i] = 1.0 / s
    } else {
      D[i] = 1.0
    }
  }
  */
  //Initialize
  A.apply(x, R)
  var At = A.transpose()

  for(i=0; i<n; ++i) {
    R[i] = b[i] - R[i]
//    Z[i] = D[i] * R[i]
//    P[i] = R[i]
  }
  At.apply(R, P)
  //Iterate
  for(k=0; k<max_iter; ++k) {
    A.apply(P, Z) // Z = A * P
    At.apply(R, U) // U = At * R

    alpha_n = norm2(U)
    alpha = alpha_n / norm2(Z)
    beta = 0.0
    rnorm = 0.0
    for(i=0; i<n; ++i) {
      x[i] += alpha * P[i]
      R[i] -= alpha * Z[i]
      rnorm = max(rnorm, abs(R[i]))
    }
    if(rnorm < tolerance) {
      break
    }

    At.apply(R, U) // U = At * R
    beta = norm2(U)
    beta /= alpha_n
    for(i=0; i<n; ++i) {
      P[i] = U[i] + beta * P[i]
    }
  }
  console.log("rnorm: ", rnorm)
  return x
}

//module.exports = conjugateGradient
var pcg = conjugateGradient




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
    coeffs.push([i + N, handleIds[i], 1])
  }

  var augMat = CSRMatrix.fromList(coeffs, M, N)
  // calculate square matrix
//  var mmt = csrgemtm(augMat, augMat)

  /*
  // calculate preconditioner
  var pi = cmprecond(mmt, N)
  */

  // precalculate solver
  var solve = qrSolve.prepare(coeffs, M, N)

  var b = new Float64Array(M)
  var y = new Float64Array(N)
  var out = new Float64Array(3 * N)

  return function (handlePositions, _out) {

    for (var d = 0; d < 3; ++d) {
      var lp = delta[d]
      for (var i = 0; i < N; ++i) {
        b[i] = lp[i]
      }
      for (var j = 0; j < handlePositions.length; ++j) {
        b[j + N] = handlePositions[j][d]
      }
      // use conjugate gradient.
      solve(b, y)

      for (var k = 0; k < N; ++k) {
        out[3 * k + d] = y[k]
      }
    }

    return out
  }
}
