var calcLaplacian = require('./laplacian').calcLaplacianReal

var cells = [ [0, 1, 2]

            //  , [3, 4, 5], [6, 7, 8]

            ]
/*var positions = [
  [1,0,0], [2,0,0], [1,1,0],

  [1,3,0], [2,3,0], [1,4,0],

  [1,8,0], [2,8,0], [1,9,0]
]
*/

var cells = require('conway-hart')('T').cells
var positions = require('conway-hart')('T').positions
console.log("start cells: ", cells)
console.log("start positions: ", positions)

var N = positions.length*3
var trace = new Float64Array(N)


var coeffs = calcLaplacian(cells, positions, trace)

var mat = []
for(var i = 0; i < N; ++i) {
  mat[i] = []
  for(var j = 0; j < N; ++j) {
    mat[i][j] = 0
  }
}

console.log(coeffs)

for(var i = 0; i < coeffs.length; ++i) {
  var e = coeffs[i]

  mat[e[0]][e[1]] = e[2]

}

console.log(mat)
console.log(trace)

//var mmt = csrgemtm(augMat, augMat.transpose())

/*
[
  [ -1, 0.5, 0.5 ],
  [ 1, -1, -0 ],
    <ZZ[ 1, -0, -1 ] ]
*/


/*
[ [ -1, 0.5, 0.5, 0, 0, 0, 0, 0, 0 ],
  [ 1, -1, -0, 0, 0, 0, 0, 0, 0 ],
  [ 1, -0, -1, 0, 0, 0, 0, 0, 0 ],

  [ 0, 0, 0, -1, 0.5, 0.5, 0, 0, 0 ],
  [ 0, 0, 0, 1, -1, -0, 0, 0, 0 ],
  [ 0, 0, 0, 1, -0, -1, 0, 0, 0 ],

  [ 0, 0, 0, 0, 0, 0, -1, 0.5, 0.5 ],
  [ 0, 0, 0, 0, 0, 0, 1, -1, -0 ],
  [ 0, 0, 0, 0, 0, 0, 1, -0, -1 ] ]
*/

var m = require('conway-hart')('T')

var adj = []
for(var i = 0; i < m.positions.length; ++i) {
  adj[i] = []
}

for(var i = 0; i < m.cells.length; ++i) {
  var c = m.cells[i]
  for(var j = 0; j < 3; ++j) {
    var a = c[j+0]
    var b = c[(j+1) % 3]
    adj[a].push(b)
  }
}

//console.log("m: ", m)
//console.log("adj: ", adj)
