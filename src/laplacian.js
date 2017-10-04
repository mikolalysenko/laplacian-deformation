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

module.exports.calcLaplacian = function (cells, positions, trace, handlesObj, handlesMap, adj) {
  var i

  var ha = handlesObj.handles

  var N = ha.length*3

//  console.log("BREAK HERE")
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

//  console.log("after: ", (result) )

//  result.sort(comparePair)

  return result
}

module.exports.calcLaplacianReal = function (cells, positions, trace, delta, handlesObj, invHandlesMap, handlesMap, adj) {
  var i
//  console.log("begin calc real laplacina")

  var ha = handlesObj.handles

  var Ts = []

  for(var i = 0; i < handlesObj.afterHandlesMore; ++i) {
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

    /*
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
    */

    var pseudoinv = mathjs.multiply(invprod, At)

    Ts[i] = pseudoinv



    /*
    var testv = []
    var y = 0
    for (var o = 0; o < inset.length; ++o) {
      var d = invHandlesMap[inset[o]]
      testv[y++] = positions[d][0]
      testv[y++] = positions[d][1]
      testv[y++] = positions[d][2]
    }


    var sanitycheck = mathjs.multiply(pseudoinv, testv);
    for(var p = 0; p < sanitycheck.length; ++p) {
      var pass = true
      var e = sanitycheck[p]
      if(p == 0) {
        if(Math.abs(e-1.0) > 1e-6) {
          pass = false
        }
      } else {
        if(Math.abs(e) > 1e-6) {
          pass = false
        }

      }

      if(!pass) {
        console.log("sanity check fail: ", sanitycheck)
      }

    }
    */


  }


  var N = handlesObj.handles.length*3

//  console.log("BREAK HERE")
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

    if(k >= handlesObj.afterHandlesMore) {
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
     buf[p * handlesObj.handles.length + r] -= 1  * (+tx[j])
      }
    } else if(d == 1) { // y case.
      for(var j = 0; j < T[0].length; ++j) {
        var p = j % 3 // coord component
        var q = Math.floor(j / 3)
        var r = b[q] // set member vertex index.

        buf[p * handlesObj.handles.length + r] -= dx * (+h3[j])
        buf[p * handlesObj.handles.length + r] -= dy * (+s[j])
        buf[p * handlesObj.handles.length + r] -= dz * (-h1[j])
        buf[p * handlesObj.handles.length + r] -= 1  * (+ty[j])
      }
    } else if(d == 2) { // y case.
      for(var j = 0; j < T[0].length; ++j) {
        var p = j % 3 // coord component
        var q = Math.floor(j / 3)
        var r = b[q] // set member vertex index.

        buf[p * handlesObj.handles.length + r] -= dx * (-h2[j])
        buf[p * handlesObj.handles.length + r] -= dy * (+h1[j])
        buf[p * handlesObj.handles.length + r] -= dz * (+s[j])
        buf[p * handlesObj.handles.length + r] -= 1  * (+tz[j])
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
