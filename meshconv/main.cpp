#include <stdio.h>
#include <string>
#include <vector>
#include <algorithm>


using std::vector;
using std::string;

vector<string> split(const string& str, const string& delim)
{
    vector<string> tokens;
    size_t prev = 0, pos = 0;
    do
    {
        pos = str.find(delim, prev);
        if (pos == string::npos) pos = str.length();
        string token = str.substr(prev, pos-prev);
        if (!token.empty()) tokens.push_back(token);
        prev = pos + delim.length();
    }
    while (pos < str.length() && prev < str.length());
    return tokens;
}

struct Vertex {
    float x,y,z;

    Vertex(float x_, float y_, float z_) {
        x = x_;
        y = y_;
        z = z_;

    }
};

struct Tri {
    int i[3];

    Tri(float i_, float j_, float k_) {
        i[0] = i_;
        i[1] = j_;
        i[2] = k_;



    }
};

int main() {
    FILE * pFile;
    pFile = fopen ("octopus-high.mesh","r");
    char mystring [100];

    vector<Vertex> vertices;
    vector<Tri> tris;


    if (pFile!=NULL)
    {
        fgets (mystring , 100 , pFile);
        fgets (mystring , 100 , pFile);
        fgets (mystring , 100 , pFile);

        fgets (mystring , 100 , pFile);
        std::string line(mystring);

        int numVertices = stoi(line);
        printf("%d\n", numVertices);

        for(int i = 0; i < numVertices; ++i) {
            fgets (mystring , 100 , pFile);
            std::string line(mystring);
            std::vector<std::string> tokens = split(line, " ");
            float x = stof(tokens[0]);
            float y = stof(tokens[1]);
            float z = stof(tokens[2]);
            // printf("%f %f %f\n", x,y,z);


            vertices.push_back(Vertex(x,y,z));
        }

        fgets (mystring , 100 , pFile);

        fgets (mystring , 100 , pFile);
        line = std::string(mystring);

        int numFaces = stoi(line);

        for(int a = 0; a < numFaces; ++a) {
            fgets (mystring , 100 , pFile);
            std::string line(mystring);
            std::vector<std::string> tokens = split(line, " ");

            int i = stoi(tokens[0]);
            int j = stoi(tokens[1]);
            int k = stoi(tokens[2]);
            int l = stoi(tokens[2]);



            tris.push_back(Tri(i,j,k));
            tris.push_back(Tri(i,k,l));

        }



        //    fputs ("fopen example",pFile);
//      fclose (pFile);
    }
    fclose(pFile);


    pFile = fopen ("out.obj","w");

    for(int i = 0; i < vertices.size(); ++i) {
        Vertex v = vertices[i];

        fprintf(pFile, "v %f %f %f\n", v.x, v.y, v.z);
    }

    for(int i = 0; i < tris.size(); ++i) {
        Tri t = tris[i];

        fprintf(pFile, "f %d %d %d\n", t.i[0], t.i[1], t.i[2]);
    }


}
