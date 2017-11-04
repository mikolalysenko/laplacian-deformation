function sparseDotProduct (
  astart, aend, aids, aptrs, adata,
  bstart, bend, bids, bptrs, bdata) {
  var result = 0

  var a = astart
  var b = bstart

  var adlo = aptrs[a]
  var adhi = aptrs[a + 1]
  var aclo = aids[a]
  var achi = aclo + adhi - adlo

  var bdlo = bptrs[b]
  var bdhi = bptrs[b + 1]
  var bclo = bids[b]
  var bchi = bclo + bdhi - bdlo

  while (true) {
    // intersect column intervals intervals
    var clo = Math.max(aclo, bclo)
    var chi = Math.min(achi, bchi)

    // dot product
    var aptr = adlo + clo - aclo
    var bptr = bdlo + clo - bclo
    for (var c = clo; c < chi; ++c) {
      result += adata[aptr++] * bdata[bptr++]
    }

    // step intervals
    var astep = achi <= bchi
    var bstep = bchi <= achi
    if (astep) {
      // step a
      if (++a >= aend) {
        break
      }
      adlo = aptrs[a]
      adhi = aptrs[a + 1]
      aclo = aids[a]
      achi = aclo + adhi - adlo
    }
    if (bstep) {
      // step b
      if (++b >= bend) {
        break
      }
      bdlo = bptrs[b]
      bdhi = bptrs[b + 1]
      bclo = bids[b]
      bchi = bclo + bdhi - bdlo
    }
  }

  return result
}

// sparse matrix-transpose-multiply
// - assume b is transpose
module.exports = function csrgemtm (a, b) {
  var result = []

  var arows = a.rows
  var arowPtrs = a.row_ptrs
  var acols = a.columns
  var acolPtrs = a.column_ptrs
  var adata = a.data

  var brows = b.rows
  var browPtrs = b.row_ptrs
  var bcols = b.columns
  var bcolPtrs = b.column_ptrs
  var bdata = b.data

  for (var i = 0; i < arows.length - 1; ++i) {
    var r = arows[i]
    var astart = arowPtrs[i]
    var aend = arowPtrs[i + 1]

    for (var j = 0; j < brows.length - 1; ++j) {
      var c = brows[j]
      var bstart = browPtrs[j]
      var bend = browPtrs[j + 1]

      var v = sparseDotProduct(
        astart, aend, acols, acolPtrs, adata,
        bstart, bend, bcols, bcolPtrs, bdata)

      if (v) {
        result.push([r, c, v])
      }
    }
  }

  return result
}
