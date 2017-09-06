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

/*
  module.exports = function calcLaplacian (cells, positions) {
  var i
  var numVerts = positions.length
  var numCells = cells.length

  var trace = new Float64Array(positions.length)
  for (i = 0; i < numVerts; ++i) {
  trace[i] = 0
  }

  var result = []

  for (i = 0; i < numCells; ++i) {
  var cell = cells[i]
  var ia = cell[0]
  var ib = cell[1]
  var ic = cell[2]

  var a = positions[ia]
  var b = positions[ib]
  var c = positions[ic]

  var abx = a[0] - b[0]
  var aby = a[1] - b[1]
  var abz = a[2] - b[2]

  var bcx = b[0] - c[0]
  var bcy = b[1] - c[1]
  var bcz = b[2] - c[2]

  var cax = c[0] - a[0]
  var cay = c[1] - a[1]
  var caz = c[2] - a[2]

  var area = 0.5 * hypot(
  aby * caz - abz * cay,
  abz * cax - abx * caz,
  abx * cay - aby * cax)

  if (area < 1e-8) {
  continue
  }

  var w = -0.5 / area
  var wa = w * (abx * cax + aby * cay + abz * caz)
  var wb = w * (bcx * abx + bcy * aby + bcz * abz)
  var wc = w * (cax * bcx + cay * bcy + caz * bcz)

  trace[ia] += wb + wc
  trace[ib] += wc + wa
  trace[ic] += wa + wb

  result.push(
  [ib, ic, wa],
  [ic, ib, wa],
  [ic, ia, wb],
  [ia, ic, wb],
  [ia, ib, wc],
  [ib, ia, wc])
  }

  result.sort(comparePair)

  var ptr = 0
  for (i = 0; i < result.length;) {
  var entry = result[i++]
  while (i < result.length && comparePair(result[i], entry) === 0) {
  entry[2] += result[i++][2]
  }
  entry[2] /= trace[entry[0]]
  result[ptr++] = entry
  }
  result.length = ptr

  for (i = 0; i < numVerts; ++i) {
  result.push([i, i, -1])
  }

  return result
  }
*/

module.exports.calcLaplacian = function (cells, positions, trace) {
  var i
  console.log("begin calc laplacina")


  var adj = []
  for(var i = 0; i < positions.length; ++i) {
    adj[i] = []
  }

  for(var i = 0; i < cells.length; ++i) {
    var c = cells[i]
    for(var j = 0; j < 3; ++j) {
      var a = c[j+0]
      var b = c[(j+1) % 3]
      adj[a].push(b)
    }
  }
/*

  for(var i = 0; i < positions.length; ++i) {
    // compute transform T_i

    At_coeffs = []

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


      var vk = positions[k]
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

    var eps = 0.00001
    var sanity = mathjs.multiply(invprod, prod)
    //    console.log("sanity: ", sanity)
    for(var a = 0; a < sanity.length; ++a) {
      for(var b = 0; b < sanity.length; ++b) {

        if(a == b) {
          if(Math.abs(sanity[a][b] - 1.0) > eps) {
            console.log("MATRIX DID NOT PASS SANITY ", i, sanity)
            return
          }
        } else {

          if(Math.abs(sanity[a][b]) > eps) {
            console.log("MATRIX DID NOT PASS SANITY ", i, sanity)
            return
          }

        }

      }
    }

    var pseudoinv = mathjs.multiply(invprod, At)


    //  var At_mat = CSRMatrix.fromList(At_coeffs, 7, inset.length*3)
  }
*/


  var N = positions.length*3

  console.log("BREAK HERE")
  var buf = new Float64Array(N)
  var result = []

  for(i = 0; i < N; ++i) {

    for(j = 0; j < N; ++j) {
      buf[j] = 0
    }

    buf[i] = 1

    var d = Math.floor(i / positions.length)

    var k = i - d * positions.length

    var w = -1.0 / adj[k].length

    for(var j = 0; j < adj[k].length; ++j) {
      buf[d * positions.length +  adj[k][j]  ] = w
    }

    for(var j = 0; j < N; ++j) {

      if(Math.abs(buf[j]) > 1e-7) {
        result.push([i, j, buf[j]])
      }

    }

  }

  console.log("after: ", (result) )

  result.sort(comparePair)

  return result
}

module.exports.calcLaplacianReal = function (cells, positions, trace, delta) {
  var i
  console.log("begin calc real laplacina")

  var adj = []
  for(var i = 0; i < positions.length; ++i) {
    adj[i] = []
  }

  for(var i = 0; i < cells.length; ++i) {
    var c = cells[i]
    for(var j = 0; j < 3; ++j) {
      var a = c[j+0]
      var b = c[(j+1) % 3]
      adj[a].push(b)
    }
  }

  var Ts = []

  for(var i = 0; i < positions.length; ++i) {
    // compute transform T_i

    At_coeffs = []

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


      var vk = positions[k]
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

    var eps = 0.00001
    var sanity = mathjs.multiply(invprod, prod)
    //    console.log("sanity: ", sanity)
    for(var a = 0; a < sanity.length; ++a) {
      for(var b = 0; b < sanity.length; ++b) {

        if(a == b) {
          if(Math.abs(sanity[a][b] - 1.0) > eps) {
            console.log("MATRIX DID NOT PASS SANITY ", i, sanity)
            return
          }
        } else {

          if(Math.abs(sanity[a][b]) > eps) {
            console.log("MATRIX DID NOT PASS SANITY ", i, sanity)
            return
          }

        }

      }
    }

    var pseudoinv = mathjs.multiply(invprod, At)

    Ts[i] = pseudoinv
    //  var At_mat = CSRMatrix.fromList(At_coeffs, 7, inset.length*3)
  }

  console.log("Ts: ", Ts)


  console.log("check here")


  var N = positions.length*3

  console.log("BREAK HERE")
  var buf = new Float64Array(N)
  var result = []

  for(i = 0; i < N; ++i) {

    for(j = 0; j < N; ++j) {
      buf[j] = 0
    }

    // TODO: is this really correct? compare with the of calcLaplacian()
    buf[i] = 1

    // coordinate component. x=0, y=1, z=1
    var d = Math.floor(i / positions.length)

    // vertex number.
    var k = i - d * positions.length

    var w = -1.0 / adj[k].length

    for(var j = 0; j < adj[k].length; ++j) {
      buf[d * positions.length +  adj[k][j]  ] = w
    }

    var dx = delta[k + positions.length * 0]
    var dy = delta[k + positions.length * 1]
    var dz = delta[k + positions.length * 2]

    var b = []
    b.push(i)
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
        buf[p * positions.length + r] -= dx * (+s[j])
        buf[p * positions.length + r] -= dy * (-h3[j])
        buf[p * positions.length + r] -= dz * (+h2[j])
        buf[p * positions.length + r] -= 1  * (+tx[j])
      }
    } else if(d == 1) { // y case.
      for(var j = 0; j < T[0].length; ++j) {
        var p = j % 3 // coord component
        var q = Math.floor(j / 3)
        var r = b[q] // set member vertex index.

        buf[p * positions.length + r] -= dx * (+h3[j])
        buf[p * positions.length + r] -= dy * (+s[j])
        buf[p * positions.length + r] -= dz * (-h1[j])
        buf[p * positions.length + r] -= 1  * (+ty[j])
      }
    } else if(d == 2) { // y case.
      for(var j = 0; j < T[0].length; ++j) {
        var p = j % 3 // coord component
        var q = Math.floor(j / 3)
        var r = b[q] // set member vertex index.

        buf[p * positions.length + r] -= dx * (-h2[j])
        buf[p * positions.length + r] -= dy * (+h1[j])
        buf[p * positions.length + r] -= dz * (+s[j])
        buf[p * positions.length + r] -= 1  * (+tz[j])
      }
    }

    for(var j = 0; j < N; ++j) {

      if(Math.abs(buf[j]) > 1e-7) {
        result.push([i, j, buf[j]])
      }

    }

  }

  console.log("after: ", (result) )

  result.sort(comparePair)

  return result''


}


module.exports.calcLaplacianReal2 = function (cells, positions, trace, delta) {
  var i
  console.log("begin calc real laplacina")

  var adj = []
  for(var i = 0; i < positions.length; ++i) {
    adj[i] = []
  }

  for(var i = 0; i < cells.length; ++i) {
    var c = cells[i]
    for(var j = 0; j < 3; ++j) {
      var a = c[j+0]
      var b = c[(j+1) % 3]
      adj[a].push(b)
    }
  }

  var Ts = []

  var result = []


  for(var i = 0; i < positions.length; ++i) {
    // compute transform T_i

    At_coeffs = []

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


      var vk = positions[k]
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

    var eps = 0.00001
    var sanity = mathjs.multiply(invprod, prod)
    //    console.log("sanity: ", sanity)
    for(var a = 0; a < sanity.length; ++a) {
      for(var b = 0; b < sanity.length; ++b) {

        if(a == b) {
          if(Math.abs(sanity[a][b] - 1.0) > eps) {
            console.log("MATRIX DID NOT PASS SANITY ", i, sanity)
            return
          }
        } else {

          if(Math.abs(sanity[a][b]) > eps) {
            console.log("MATRIX DID NOT PASS SANITY ", i, sanity)
            return
          }

        }

      }
    }

    var pseudoinv = mathjs.multiply(invprod, At)

       var T = pseudoinv

    // s is row 0 of T times b.
    var s = 0
    var h1 = 1
    var h2 = 2
    var h3 = 3
    var tx = 4
    var ty = 5
    var tz = 6

    for(var j = 0; j < inset.length; ++j) {
      var e = inset[j]

      var dx = delta[e + positions.length * 0]
      var dy = delta[e + positions.length * 1]
      var dz = delta[e + positions.length * 2]

      // v'1
      var ax = dx * A[s][0 + j*3] - dy * A[h3][0 + j*3] + dz * A[h2][0 + j*3] + A[tx][0 + j*3]
      var ay = dx * A[s][1 + j*3] - dy * A[h3][1 + j*3] + dz * A[h2][1 + j*3] + A[tx][1 + j*3]
      var az = dx * A[s][2 + j*3] - dy * A[h3][2 + j*3] + dz * A[h2][2 + j*3] + A[tx][2 + j*3]



      // now do bx. is second row of T_ij
      var bx = dx * A[s][0 + j*3] - dy * A[h3][0 + j*3] + dz * A[h2][0 + j*3] + A[tx][0 + j*3]



      var row = 3 * inset[0]
      var col = 3 * e

      result.push_back([row+0, col+0, ax])
      result.push_back([row+0, col+1, ay])
      result.push_back([row+0, col+2, az])

      result.push_back([row+1, col+0, bx])
      result.push_back([row+1, col+1, by])
      result.push_back([row+1, col+2, bz])

      result.push_back([row+2, col+0, cx])
      result.push_back([row+2, col+1, cy])
      result.push_back([row+2, col+2, cz])


      // output to
      // row+0
      // row+1
      // row+2

      // col+0
      // col+1
      // col+2

    }


    //Ts[i] = pseudoinv
    //  var At_mat = CSRMatrix.fromList(At_coeffs, 7, inset.length*3)
  }

  console.log("Ts: ", Ts)


  console.log("check here")


  var N = positions.length*3

  console.log("BREAK HERE")
  var buf = new Float64Array(N)

  for(i = 0; i < N; ++i) {

    for(j = 0; j < N; ++j) {
      buf[j] = 0
    }

    // TODO: is this really correct? compare with the of calcLaplacian()
    buf[i] = 1

    // coordinate component. x=0, y=1, z=1
    var d = Math.floor(i / positions.length)

    // vertex number.
    var k = i - d * positions.length

    var w = -1.0 / adj[k].length

    for(var j = 0; j < adj[k].length; ++j) {
      buf[d * positions.length +  adj[k][j]  ] = w
    }

    var dx = delta[k + positions.length * 0]
    var dy = delta[k + positions.length * 1]
    var dz = delta[k + positions.length * 2]

    var b = []
    b.push(i)
    for(var j = 0; j < adj[k].length; ++j) {
      // TODO: dont we need something like d*positions.length somewhere?
      b.push(adj[k][j])
    }
  }


  console.log("after: ", (result) )

  result.sort(comparePair)

  return result


}
