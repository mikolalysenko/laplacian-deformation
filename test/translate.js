var tape = require('tape')
var deform = require('../index')
var ch = require('conway-hart')
var icosphere = require('icosphere')

var TOLERANCE = 1e-4

function roundScalar (v) {
  return Math.round(v / TOLERANCE) * TOLERANCE
}

function roundStr (x) {
  return '[' + x.map(roundScalar) + ']'
}

tape('translation', function (t) {
  function testTranslate (cells, positions, handleId) {
    var calcMesh = deform(cells, positions, [0, 1])

    var baseP = positions[0]
    var baseQ = positions[1]

    return function (offset, comment) {
      var d = calcMesh([

        [
          baseP[0],
          baseP[1],
          baseP[2]
        ],

        [
          baseQ[0],
          baseQ[1],
          baseQ[2]
        ]

                       ])

      var actualResult = []
      var expectedResult = []
      var original = []

      for (var i = 0; i < positions.length; ++i) {
        var actual = [
          d[3 * i],
          d[3 * i + 1],
          d[3 * i + 2]
        ]
        var expected = [
          positions[i][0] + offset[0],
          positions[i][1] + offset[1],
          positions[i][2] + offset[2]
        ]
        actualResult.push(roundStr(actual))
        expectedResult.push(roundStr(expected))
        original.push(roundStr(positions[i]))
      }

      console.log("orig: ", original)
//      console.log("actualResult: ", actualResult.join())
//      console.log("expectedResult: ", expectedResult.join())

      t.equals(actualResult.join(), expectedResult.join(), comment)
    }
  }

    const tetrahedron = ch('T')
  // this one works for restoring.
//   const tetrahedron = icosphere(4)

  //  var tetrahedron = require('primitive-sphere')(1.0, { segments: 1 })
//  console.log("cube: ", tetrahedron )
  console.log("cube vertices: ", tetrahedron.positions.length )

 // console.log("IN MESH: ", tetrahedron)
  var runTest = testTranslate(tetrahedron.cells, tetrahedron.positions, 0)

  runTest([0, 0, 0])
/*
  runTest([-1, -1, -1])
  runTest([1, 0, 0])
  runTest([0, 1, 0])
  runTest([0, 0, 1])
*/
  t.end()
})
