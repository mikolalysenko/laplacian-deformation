var tape = require('tape')
var CSRMatrix = require('csr-matrix')
var csrgemtm = require('../src/csrgemtm')

var TOLERANCE = 1e-6

function canonicalizeList (a) {
  a.sort(function (x, y) {
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  })
  return a.map(function (entry) {
    var v = Math.round(entry[2] / TOLERANCE) * TOLERANCE
    return '[' + entry[0] + ',' + entry[1] + ',' + v + ']'
  }).join()
}

function bruteForceProduct (a, b) {
  var expectedResult = {}

  for (var i = 0; i < a.length; ++i) {
    var ai = a[i]
    for (var j = 0; j < b.length; ++j) {
      var bj = b[j]
      if (ai[1] === bj[1]) {
        var key = ai[0] + ',' + bj[0]
        if (key in expectedResult) {
          expectedResult[key] += ai[2] * bj[2]
        } else {
          expectedResult[key] = ai[2] * bj[2]
        }
      }
    }
  }

  var result = []
  Object.keys(expectedResult).forEach(function (k) {
    var parts = k.split(',')
    result.push([parts[0] | 0, parts[1] | 0, expectedResult[k]])
  })
  return canonicalizeList(result)
}

function actualProduct (a, b) {
  var csra = CSRMatrix.fromList(a)
  var csrb = CSRMatrix.fromList(b)
  var ab = csrgemtm(csra, csrb)
  return canonicalizeList(ab)
}

tape('csrgemtm', function (t) {
  function test (a, b, comment) {
    var expected = bruteForceProduct(a, b)
    var actual = actualProduct(a, b)
    t.equals(actual, expected, comment)
  }

  test([
    [0, 0, 1]
  ], [
    [0, 0, 1]
  ], 'trivial scalar')

  test([
    [0, 0, 1],
    [1, 1, 1]
  ], [
    [0, 0, 1],
    [1, 1, 1]
  ], 'identity')

  test([
    [0, 0, 1],
    [0, 1, 3],
    [1, 2, 2]
  ], [
    [0, 0, 8],
    [1, 1, 2],
    [1, 3, 4],
    [2, 1, 5]
  ], 'simple')

  // fuzz
  for (var i = 0; i < 100; ++i) {
    var acoeffs = []
    var bcoeffs = []
    for (var j = 0; j < 30; ++j) {
      acoeffs.push([
        Math.round(Math.random() * 10),
        Math.round(Math.random() * 10),
        2 * Math.random() - 1
      ])
      bcoeffs.push([
        Math.round(Math.random() * 10),
        Math.round(Math.random() * 10),
        2 * Math.random() - 1
      ])
    }
    test(acoeffs, bcoeffs, 'fuzz')
  }

  t.end()
})
