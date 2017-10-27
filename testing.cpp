#include <vector>
#include <stdio.h>
#include <fstream>

using std::vector;

struct CSRMatrix {
    vector<int>rows;
    vector<int>row_ptrs;
    vector<int> columns;
    vector<int> column_ptrs;
    vector<double>data;

};

struct Tri {
    int i;
    int j;
    double v;
};

CSRMatrix fromList(vector<Tri>& items, int nrows, int ncols) {
    vector<int> rows;
    vector<int> row_ptrs;
    vector<int> cols;
    vector<int> col_ptrs;

    vector<double> data;

    nrows = nrows;
    ncols = ncols;
    data.reserve(items.size());
    for(int i=0; i<items.size(); ++i) {
        Tri item = items[i];
        if(i == 0 || item.i != items[i-1].i) {
            rows.push_back(item.i);
            row_ptrs.push_back(cols.size());
            cols.push_back(item.j);
            col_ptrs.push_back(i);
        } else if(item.j != items[i-1].j+1) {
            cols.push_back(item.j);
            col_ptrs.push_back(i);
        }
        nrows = nrows > item.i+1 ? nrows : item.i+1;
        ncols = ncols > item.j+1 ? ncols : item.j+1;
        data[i] = item.v;
        //    printf("dat: %f\n", data[i]);

    }
    rows.push_back(nrows);
    row_ptrs.push_back(cols.size());
    cols.push_back(ncols);
    col_ptrs.push_back(data.size());
    CSRMatrix cm;

    cm.rows = rows;
    cm.row_ptrs = row_ptrs;

    cm.columns = cols;
    cm.column_ptrs = col_ptrs;

    for(int i=0; i<items.size(); ++i) {
        cm.data.push_back(data[i]);
    }

    printf("data1 : %f\n", data[10]);
    printf("data2 : %f\n", cm.data[10]);

    return cm;
}

double sparseDotProduct (
    int astart, int aend, vector<int>&aids, vector<int>&aptrs, vector<double>&adata,
    int bstart, int bend, vector<int>&bids, vector<int>&bptrs, vector<double>&bdata) {
    double result = 0;

    int a = astart;
    int b = bstart;

    int adlo = aptrs[a];
    int adhi = aptrs[a + 1];
    int aclo = aids[a];
    int achi = aclo + adhi - adlo;

    int bdlo = bptrs[b];
    int bdhi = bptrs[b + 1];
    int bclo = bids[b];
    int bchi = bclo + bdhi - bdlo;

    while (true) {
        // intersect column intervals intervals
        int clo = (aclo > bclo) ? aclo : bclo;
        int chi = achi <  bchi ? achi : bchi;

        // dot product
        int aptr = adlo + clo - aclo;
        int bptr = bdlo + clo - bclo;
        for (int c = clo; c < chi; ++c) {
            result += adata[aptr++] * bdata[bptr++];
        }

        // step intervals
        int astep = achi <= bchi;
        int bstep = bchi <= achi;
        if (astep) {
            // step a
            if (++a >= aend) {
                break;
            }
            adlo = aptrs[a];
            adhi = aptrs[a + 1];
            aclo = aids[a];
            achi = aclo + adhi - adlo;
        }
        if (bstep) {
            // step b
            if (++b >= bend) {
                break;
            }
            bdlo = bptrs[b];
            bdhi = bptrs[b + 1];
            bclo = bids[b];
            bchi = bclo + bdhi - bdlo;
        }
    }

    return result;
}

// sparse matrix-transpose-multiply
// - assume b is transpose
vector<Tri> csrgemtm (CSRMatrix & a, CSRMatrix& b) {
    vector<Tri> result;

    vector<int> arows = a.rows;
    vector<int> arowPtrs = a.row_ptrs;
    vector<int> acols = a.columns;
    vector<int> acolPtrs = a.column_ptrs;
    vector<double> adata = a.data;

    vector<int> brows = b.rows;
    vector<int> browPtrs = b.row_ptrs;
    vector<int> bcols = b.columns;
    vector<int> bcolPtrs = b.column_ptrs;
    vector<double> bdata = b.data;

    for (int i = 0; i < arows.size() - 1; ++i) {
        int r = arows[i];
        int astart = arowPtrs[i];
        int aend = arowPtrs[i + 1];

        for (int j = 0; j < brows.size() - 1; ++j) {
            int c = brows[j];
            int bstart = browPtrs[j];
            int bend = browPtrs[j + 1];

            double v = sparseDotProduct(
                astart, aend, acols, acolPtrs, adata,
                bstart, bend, bcols, bcolPtrs, bdata);

            if (v) {
                Tri t;
                t.i = r;
                t.j = c;
                t.v = v;

//          result.push([r, c, v]);
//                printf("val: %f\n", t.v);
                result.push_back(t);

            }
        }
    }

    return result;
}

/*
  bool comparePair (double a, double b) {
  return a[0] - b[0] || a[1] - b[1]
  }
*/

struct  {
    bool operator()(const Tri& a, const Tri& b) {
        if(a.i != b.i) {
            return a.i < b.i;
        } else {
            return a.j < b.j;
        }
    }
} sorter;

int main() {
    printf("hello world\n");

    std::ifstream infile("sparse.txt");
    int M =6927;
    int N =6339;

    int a, b;
    float c;
    char ch = ',';

    vector<Tri> coeffsReal;

    while (infile >> a >> ch >> b >> ch >> c){
        // process pair (a,b)
//        printf("%d %d %f\n", a, b, c);

        Tri t;
        t.i = a;
        t.j = b;
        t.v = c;
        coeffsReal.push_back(t);
        //     printf("%d %d %f\n", t.i, t.j, t.v);
    }
    printf("coeffsReal: %d\n",  coeffsReal.size());
    CSRMatrix augMat = fromList(coeffsReal, M, N);

    printf("coeffsReal: %f\n",  augMat.data[0]);

    vector<Tri> coeffsRealTrans;
    for(int i = 0; i < coeffsReal.size(); ++i) {
        Tri e = coeffsReal[i];

        Tri t;
        t.i = e.j;
        t.j = e.i;
        t.v = e.v;

        coeffsRealTrans.push_back(t);
    }
    //SORT

    std::sort(coeffsRealTrans.begin(), coeffsRealTrans.end(), sorter);

    CSRMatrix augMatTrans = fromList(coeffsRealTrans, N, M);


    auto mmt = csrgemtm(augMatTrans, augMatTrans);
    printf("DONE\n");

    //fscanf(filepointer, "%d,%d,%f,%d,%d\n", &int1, &int2, &double1, &int3, &int4);

}
