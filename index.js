var mathjs = require('mathjs')

function hypot (x, y, z) {
  return Math.sqrt(
    Math.pow(x, 2) +
      Math.pow(y, 2) +
      Math.pow(z, 2))
}

function comparePair (a, b) {
  return a[0] - b[0] || a[1] - b[1]
}

// we are simply returning a list of triplets. not complicated!
var calcLaplacian = function (cells, positions, handlesObj, handlesMap, adj) {
  var i

  var ha = handlesObj.handles

  var N = ha.length*3

  var buf = new Float64Array(N)
  var result = []

  for(i = 0; i < N; ++i) {

    for(j = 0; j < N; ++j) {
      buf[j] = 0
    }

    buf[i] = 1

    var d = Math.floor(i / ha.length)

    var k = i - d * ha.length

    var w = -1.0 / adj[k].length

    for(var j = 0; j < adj[k].length; ++j) {

      if((d * ha.length +  adj[k][j]) > (d+1)*ha.length ) {
        console.log("BAD")
      }

      buf[d * ha.length +  adj[k][j]  ] = w
    }

    for(var j = 0; j < N; ++j) {

      if(Math.abs(buf[j]) > 1e-7) {
        result.push([i, j, buf[j]])
      }

    }

  }

  return result
}

var calcLaplacianReal = function (cells, positions, delta, handlesObj, invHandlesMap, handlesMap, adj) {
  var i
  var ha = handlesObj.handles

  var Ts = []

  for(var i = 0; i < handlesObj.stationaryBegin; ++i) {
    // compute transform T_i

    // set of {i} and N
    var inset = []
    inset.push(i)
    for(var j = 0; j < adj[i].length; ++j) {
      inset.push(adj[i][j])
    }

    var At = []
    for(var row = 0; row < 7; ++row) {

      At[row] = []
      for(var col = 0; col < inset.length*3; ++col) {
        At[row][col] = 0
      }
    }

    for(var j = 0; j < inset.length; ++j) {
      var k = inset[j]

      var vk = positions[invHandlesMap[k]]
      const x = 0
      const y = 1
      const z = 2

      At[0][j*3 + 0] =  +vk[x]
      At[1][j*3 + 0] = 0
      At[2][j*3 + 0] = +vk[z]
      At[3][j*3 + 0] = -vk[y]
      At[4][j*3 + 0] = +1
      At[5][j*3 + 0] = 0
      At[6][j*3 + 0] = 0

      At[0][j*3 + 1] = +vk[y]
      At[1][j*3 + 1] = -vk[z]
      At[2][j*3 + 1] = 0
      At[3][j*3 + 1] = +vk[x]
      At[4][j*3 + 1] = 0
      At[5][j*3 + 1] = +1
      At[6][j*3 + 1] = 0

      At[0][j*3 + 2] = +vk[z]
      At[1][j*3 + 2] = +vk[y]
      At[2][j*3 + 2] = -vk[x]
      At[3][j*3 + 2] = 0
      At[4][j*3 + 2] = 0
      At[5][j*3 + 2] = 0
      At[6][j*3 + 2] = 1

    }

    var A = mathjs.transpose(At)
    var prod = mathjs.multiply(At, A)

    var invprod = mathjs.inv(prod)

    var pseudoinv = mathjs.multiply(invprod, At)

    Ts[i] = pseudoinv
  }

  var N = handlesObj.handles.length*3

  var buf = new Float64Array(N)
  var result = []

  for(i = 0; i < N; ++i) {

    for(j = 0; j < N; ++j) {
      buf[j] = 0
    }

    // TODO: is this really correct? compare with the of calcLaplacian()
    buf[i] = 1

    // coordinate component. x=0, y=1, z=1
    var d = Math.floor(i / handlesObj.handles.length)

    // vertex number.
    var k = i - d * handlesObj.handles.length

    if(k >= handlesObj.stationaryBegin) {
      continue // static vertex, so we specify no information.
    }

    var w = -1.0 / adj[k].length

    for(var j = 0; j < adj[k].length; ++j) {
      buf[d * handlesObj.handles.length +  adj[k][j]  ] = w
    }

    var dx = delta[k + handlesObj.handles.length * 0]
    var dy = delta[k + handlesObj.handles.length * 1]
    var dz = delta[k + handlesObj.handles.length * 2]

    var b = []
    b.push(k) // TODO: wait a minute, should i really be here!?!?!
    for(var j = 0; j < adj[k].length; ++j) {
      // TODO: dont we need something like d*positions.length somewhere?
      b.push(adj[k][j])
    }

    var T = Ts[k]

    // s is row 0 of T times b.
    var s = T[0]
    var h1 = T[1]
    var h2 = T[2]
    var h3 = T[3]
    var tx = T[4]
    var ty = T[5]
    var tz = T[6]

    if(d == 0) { // x case.
      for(var j = 0; j < T[0].length; ++j) {
        var p = j % 3 // coord component
        var q = Math.floor(j / 3)
        var r = b[q] // set member vertex index.

        // buf is xxxxxyyyyyzzz
        // but s, h3,... are xyzxyzxyz
        buf[p * handlesObj.handles.length + r] -= dx * (+s[j])
        buf[p * handlesObj.handles.length + r] -= dy * (-h3[j])
        buf[p * handlesObj.handles.length + r] -= dz * (+h2[j])
//     buf[p * handlesObj.handles.length + r] -= 1  * (+tx[j])
      }
    } else if(d == 1) { // y case.
      for(var j = 0; j < T[0].length; ++j) {
        var p = j % 3 // coord component
        var q = Math.floor(j / 3)
        var r = b[q] // set member vertex index.

        buf[p * handlesObj.handles.length + r] -= dx * (+h3[j])
        buf[p * handlesObj.handles.length + r] -= dy * (+s[j])
        buf[p * handlesObj.handles.length + r] -= dz * (-h1[j])
     //   buf[p * handlesObj.handles.length + r] -= 1  * (+ty[j])
      }
    } else if(d == 2) { // y case.
      for(var j = 0; j < T[0].length; ++j) {
        var p = j % 3 // coord component
        var q = Math.floor(j / 3)
        var r = b[q] // set member vertex index.

        buf[p * handlesObj.handles.length + r] -= dx * (-h2[j])
        buf[p * handlesObj.handles.length + r] -= dy * (+h1[j])
        buf[p * handlesObj.handles.length + r] -= dz * (+s[j])
//        buf[p * handlesObj.handles.length + r] -= 1  * (+tz[j])
      }
    }

    for(var j = 0; j < N; ++j) {

      if(Math.abs(buf[j]) > 1e-7) {
        result.push([i, j, buf[j]])
      }

    }

  }

  result.sort(comparePair)

  return [Ts, result]
}

var CSRMatrix = require('csr-matrix')
var mathjs = require('mathjs')

let li = require("./mylib.js")
let EmscriptenMemoryManager = li.EmscriptenMemoryManager
let SparseMatrix = li.SparseMatrix
let DenseMatrix = li.DenseMatrix
let Triplet = li.Triplet

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

// sparse matrix coeffs are in the argument.
function augmentMatrix(coeffsReal, handlesObj, N, M, handlesMap, is2) {
  var preprocess = []

  if(is2) {
    // zero out constraints involving static vertices.
    for(var i = 0; i < coeffsReal.length; ++i) {
      var e = coeffsReal[i]

      var myi = e[0] % handlesObj.handles.length
      if(handlesObj.stationaryBegin > myi) {
        preprocess.push([e[0], e[1], e[2]])
      } else {
        e = e
      }
    }
    preprocess.sort(comparePair)
    coeffsReal = preprocess
  }


  // add handles.
  var P = handlesObj.handles.length
  for (var i = 0; i < handlesObj.unconstrainedBegin; ++i) {
    coeffsReal.push([i*3 + N + 0, handlesMap[handlesObj.handles[i]] + 0 * P, 1])
    coeffsReal.push([i*3 + N + 1, handlesMap[handlesObj.handles[i]] + 1 * P, 1])
    coeffsReal.push([i*3 + N + 2, handlesMap[handlesObj.handles[i]] + 2 * P, 1])
  }

  // add stationary.
  for (var i = handlesObj.stationaryBegin; i < handlesObj.handles.length; ++i) {
    coeffsReal.push([(i-handlesObj.stationaryBegin)*3 + N + 0 + handlesObj.unconstrainedBegin*3, handlesMap[handlesObj.handles[i]] + 0 * P, 1])
    coeffsReal.push([(i-handlesObj.stationaryBegin)*3 + N + 1 + handlesObj.unconstrainedBegin*3, handlesMap[handlesObj.handles[i]] + 1 * P, 1])
    coeffsReal.push([(i-handlesObj.stationaryBegin)*3 + N + 2 + handlesObj.unconstrainedBegin*3, handlesMap[handlesObj.handles[i]] + 2 * P, 1])
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

module.exports = function (
  cells, // just a list of trees.
  positions, // just a list of vectors.
  handlesObj) {
  var ROT_INV = true // rotation invariant algorithm

  var N = handlesObj.handles.length*3

  var numHandles = handlesObj.unconstrainedBegin - 0
  var numStationary = handlesObj.handles.length - handlesObj.stationaryBegin

  var M = N + (numHandles + numStationary)*3

  // can just be a regular array.  of length handlesObj.handles.length.
  var handlesMap = {}
  var invHandlesMap = {}
  for(var i = 0; i < handlesObj.handles.length; ++i) {
    handlesMap[handlesObj.handles[i]] = i
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
      if((a !== undefined && b !== undefined)) {
        adj[a].push(b)
      }
    }
  }

  // this part is easy. just use triplets.
  var coeffs = calcLaplacian(cells, positions, handlesObj, handlesMap, adj)
  var lapMat = CSRMatrix.fromList(coeffs, N, N)

  // also pretty simple.
  var flattened = new Float64Array(N)
  var c = 0
  for (var d = 0; d < 3; ++d) {
    for (var i = 0; i < handlesObj.handles.length; ++i) {
      flattened[c++] = positions[handlesObj.handles[i]][d]
    }
  }
  var delta = lapMat.apply(flattened, new Float64Array(N))

  var origLengths = []
  for(var i = 0; i < delta.length/3; ++i) {
    var ax = delta[i + 0*(N/3)]
    var ay = delta[i + 1*(N/3)]
    var az = delta[i + 2*(N/3)]

    var len = Math.sqrt(ax*ax + ay*ay + az*az)
    origLengths[i] = len
  }

  // all right, got the delta coords. now use the delta coords to calculate the REAL matrix!
  var coeffsReal
  var Ts
  if(ROT_INV) {
    var a = calcLaplacianReal(cells, positions, delta, handlesObj, invHandlesMap, handlesMap, adj)
    Ts = a[0]
    coeffsReal = a[1]
  } else {
    coeffsReal = coeffs
  }

  var a = augmentMatrix(coeffsReal, handlesObj, N, M, handlesMap, false)
  var llt = a[0]
  var augMatTrans = a[1]

  a = augmentMatrix(coeffs, handlesObj, N, M, handlesMap, true)
  var llt2 = a[0]
  var augMatTrans2 = a[1]

  var b = new Float64Array(M)
  var x = new Float64Array(N)
  var y = new Float64Array(N)
  var othery = new Float64Array(M)

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
        outPositions[invHandlesMap[i]][d] = ret.get(i + d*(N/3), 0)
      }
    }


    if(ROT_INV && true) {
      c = 0
      for (var d = 0; d < 3; ++d) {
        for (var i = 0; i < handlesObj.handles.length; ++i) {
          flattened[c++] = positions[handlesObj.handles[i]][d]
        }
      }

      var solutionDelta = lapMat.apply(flattened, new Float64Array(N))

      var solutionDeltaTrans = []
      for (var i = 0; i < handlesObj.handles.length; ++i) {
        solutionDeltaTrans[i] = [
          solutionDelta[i + 0*(N/3)],
          solutionDelta[i + 1*(N/3)],
          solutionDelta[i + 2*(N/3)],
        ]
      }

      var tempPositions = []

      for(var i = 0; i < handlesObj.stationaryBegin; ++i) {
        // compute transform T_i
/*
        // set of {i} and N
        var inset = []
        inset.push(i)
        for(var j = 0; j < adj[i].length; ++j) {
          inset.push(adj[i][j])
        }

        var v = []
        for(var j = 0; j < inset.length; ++j) {
          v.push(outPositions[invHandlesMap[inset[j]]][0])
          v.push(outPositions[invHandlesMap[inset[j]]][1])
          v.push(outPositions[invHandlesMap[inset[j]]][2])
        }

        var prod = mathjs.multiply(Ts[i], v)

        // prod[0], scale
        // prod[1], h1
        // prod[2], h2
        // prod[3], h3
        // prod[4], tx
        // prod[5], ty
        // prod[6], tz

        var s = prod[0]
        var h1 = prod[1]
        var h2 = prod[2]
        var h3 = prod[3]
        var tx = prod[4]
        var ty = prod[5]
        var tz = prod[6]

        var rcps = 1.0 / s

        var j = i
*/
        var ax = solutionDeltaTrans[i][0]
        var ay = solutionDeltaTrans[i][1]
        var az = solutionDeltaTrans[i][2]

        var len = Math.sqrt(ax*ax + ay*ay + az*az)
        var olen = origLengths[i]
        var s = olen / len

        tempPositions[i] = [s*solutionDeltaTrans[i][0], s*solutionDeltaTrans[i][1],s*solutionDeltaTrans[i][2]]
      }

      for (var d = 0; d < 3; ++d) {
        var count = 0
        for (var i = 0; i < handlesObj.stationaryBegin; ++i) {
          b[d*handlesObj.handles.length + count++] = tempPositions[i][d]
        }
      }

      augMatTrans2.apply(b, y)

      for(var i = 0; i < y.length; ++i) {
        z.set(y[i], i, 0)
      }

      var ret = llt2.solvePositiveDefinite(z)

      for (var d = 0; d < 3; ++d) {
        for (var i = 0; i < handlesObj.handles.length; ++i) {
          outPositions[invHandlesMap[i]][d] = ret.get(i + d*(N/3), 0)

        }
      }
    }
    return out

  }
}
