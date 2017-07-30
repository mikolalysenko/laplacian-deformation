function hypot (x, y, z) {
  return Math.sqrt(
    Math.pow(x, 2) +
    Math.pow(y, 2) +
    Math.pow(z, 2))
}

function comparePair (a, b) {
  return a[0] - b[0] || a[1] - b[1]
}

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
