let li = require("./mylib.js")
let EmscriptenMemoryManager = li.EmscriptenMemoryManager
let SparseMatrix = li.SparseMatrix
let Triplet = li.Triplet

//let memoryManager = new EmscriptenMemoryManager()

console.log("lol")
console.log(SparseMatrix)


let T = new Triplet(10, 10)
T.addEntry(1.2, 3, 3)
T.addEntry(1.2, 4, 3)

let B = SparseMatrix.fromTriplet(T)

console.log("B", B)
console.log("B", B.nRows())
console.log("B", B.nCols())
console.log("B", B.nnz())
