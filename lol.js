var targetMesh = require('icosphere')(2)

function fitMesh(mesh) {
  var aabb = {
    min: [+Number.MAX_VALUE, +Number.MAX_VALUE, +Number.MAX_VALUE],
    max: [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE],
  }

  /*
    Find AABB for mesh.
  */
  for(var j = 0; j < mesh.positions.length; ++j) {
    var p = mesh.positions[j]

    for(var i = 0; i < 3; ++i) {
      if(p[i] < aabb.min[i]) {
        aabb.min[i] = p[i]
      }
      if(p[i] > aabb.max[i]) {
        aabb.max[i] = p[i]
      }
    }
  }

  // find longest side of AABB.
  var il = 0
  for(var i = 1; i < 3; ++i) {
    if( (aabb.max[i]-aabb.min[i]) > aabb.max[il]-aabb.min[il]) {
      il = i
    }
  }

  /*
    Now that we have the AABB, we can use that info to the center the mesh,
    and scale it so that it fits in the unit cube.

    We do all those things for the purpose of normalizing the mesh, so
    that it is fully visible to the camera.
  */
  var s = 1.0 / (aabb.max[il]-aabb.min[il])
  var t = [
      -0.5 * (aabb.min[0] + aabb.max[0]),
      -0.5 * (aabb.min[1] + aabb.max[1]),
      -0.5 * (aabb.min[2] + aabb.max[2]),
  ]

  for(var j = 0; j < mesh.positions.length; ++j) {

    var p = mesh.positions[j]

    p[0] += t[0]
    p[1] += t[1]
    p[2] += t[2]

    p[0] *= s
    p[1] *= s
    p[2] *= s
  }
}

fitMesh(targetMesh)

var str = JSON.stringify(targetMesh)




var fs = require('fs');
fs.writeFile("out.json", str, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
});
