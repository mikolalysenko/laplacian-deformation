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

module.exports = function calcLaplacian (cells, positions, trace) {
  var i
  console.log("begin calc laplacina")

  /*
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



  console.log("len: ", trace.length)
  //  var trace = new Float64Array(positions.length)
  for (i = 0; i < trace.length; ++i) {
    trace[i] = 0
  }

  var result = []
  var N = positions.length

  for (i = 0; i < cells.length; ++i) {
    var cell = cells[i]
    var ia = cell[0]
    var ib = cell[1]
    var ic = cell[2]

    result.push(
      [ia, ib, -1],
      [ib, ic, -1],
      [ic, ia, -1])

    result.push(
      [ia+N, ib+N, -1],
      [ib+N, ic+N, -1],
      [ic+N, ia+N, -1])

    result.push(
      [ia+N*2, ib+N*2, -1],
      [ib+N*2, ic+N*2, -1],
      [ic+N*2, ia+N*2, -1])

    trace[ia] += 1
    trace[ib] += 1
    trace[ic] += 1

    trace[ia+N] += 1
    trace[ib+N] += 1
    trace[ic+N] += 1

    trace[ia+N*2] += 1
    trace[ib+N*2] += 1
    trace[ic+N*2] += 1
  }

  //  console.log("so far: ", JSON.stringify(result) )
  for(var i = 0; i < trace.length; ++i) {
    result.push(
      [i, i, trace[i]])
  }
  console.log("before: ", (result) )
  // console.log("next: ", JSON.stringify(result) )

  for(var i = 0; i < result.length; ++i) {
    var e = result[i]

    e[2] /= trace[e[0]]
  }

  console.log("after: ", (result) )

  result.sort(comparePair)

  return result
}
