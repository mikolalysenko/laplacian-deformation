var bunny = require("./bumps_dec.obj.js").bunny

var lines = bunny.split("\n")

var positions = []
var cells = []

console.log("length: ", bunny.length)
console.log("lines: ", lines.length)

var c = 0
lines.forEach(function(entry) {

  var ss = entry.split(" ")

  if(ss[0] == 'v') {
    var arr = [parseFloat(ss[1]),parseFloat(ss[2]),parseFloat(ss[3])]
    positions.push(arr)
  } else if(ss[0] == 'f') {
    var arr = [parseInt(ss[1])-1,parseInt(ss[2])-1,parseInt(ss[3])-1]
    cells.push(arr)
  }
/*  if(c < 10) {
    console.log("line: ", entry)
    console.log("line: ", arr)
  }
*/
  c++
})

var str = ""
str += "exports.positions="
str += JSON.stringify(positions)
str += "\n"

str += "exports.cells="
str += JSON.stringify(cells)

var fs = require('fs');

fs.writeFile("./bumps_dec.js", str, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
});
