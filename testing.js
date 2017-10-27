"use strict"

function CSRMatrix(rows, row_ptrs, columns, column_ptrs, data) {
  this.rows = rows
  this.row_ptrs = row_ptrs
  this.columns = columns
  this.column_ptrs = column_ptrs
  this.data = data
}

function fromList(items, nrows, ncols) {
  var rows = []
    , row_ptrs = []
    , cols = []
    , col_ptrs = []
    , data = new Float64Array(items.length)
  nrows = nrows
  ncols = ncols
  for(var i=0; i<items.length; ++i) {
    var item = items[i]
    if(i === 0 || item[0] !== items[i-1][0]) {
      rows.push(item[0])
      row_ptrs.push(cols.length)
      cols.push(item[1])
      col_ptrs.push(i)
    } else if(item[1] !== items[i-1][1]+1) {
      cols.push(item[1])
      col_ptrs.push(i)
    }
    nrows = nrows > item[0]+1 ? nrows : item[0]+1
    ncols = ncols > item[1]+1 ? ncols : item[1]+1
    data[i] = item[2]
  }
  rows.push(nrows)
  row_ptrs.push(cols.length)
  cols.push(ncols)
  col_ptrs.push(data.length)
  return new CSRMatrix(
    new Uint32Array(rows),
    new Uint32Array(row_ptrs),
    new Uint32Array(cols),
    new Uint32Array(col_ptrs),
    data)
}

CSRMatrix.fromList = fromList

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
    var clo = (aclo > bclo) ? aclo : bclo
    var chi = achi <  bchi ? achi : bchi

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
function csrgemtm (a, b) {
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
//        console.log("val: ", v)
        result.push([r, c, v])
      }
    }
  }

  return result
}

function comparePair (a, b) {
  return a[0] - b[0] || a[1] - b[1]
}

var coeffsReal = require('./sparse.js').entries
//console.log(coeffsReal)
//N:  6339
//index.js:111 M:
var M =6927
var N =6339

// this thing, times x(our desired solution) should be b.
  var augMat = CSRMatrix.fromList(coeffsReal, M, N)

  var coeffsRealTrans = []
  for(var i = 0; i < coeffsReal.length; ++i) {
    var e = coeffsReal[i]

    coeffsRealTrans.push([e[1], e[0], e[2]])
  }
  coeffsRealTrans.sort(comparePair)

  var augMatTrans = CSRMatrix.fromList(coeffsRealTrans, N, M)

  // calculate square matrix
  var mmt = csrgemtm(augMatTrans, augMatTrans)

console.log(mmt)

/*
[ [ 0, 0, 0.5706631784925759 ],
  [ 0, 17, 0.25239818788402707 ],
  [ 0, 33, -0.0012159323156611494 ],
  [ 0, 55, 0.08535313822527205 ],
  [ 0, 86, 0.06340527845285668 ],
  [ 0, 87, -0.44383669239851686 ],
  [ 0, 1445, 0.0634073300692183 ],
  [ 0, 2113, -0.0000025160895459782 ],
  [ 0, 2130, -0.000001112828551017357 ],

  */
