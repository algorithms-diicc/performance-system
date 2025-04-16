#include <iostream>
#include <algorithm>
#include <vector>
#include <fstream>
using namespace std;

int compare(const void* a, const void* b)
{
    const int* x = (int*) a;
    const int* y = (int*) b;

    if (*x > *y)
        return 1;
    else if (*x < *y)
        return -1;

    return 0;
}

int main(){
    fstream fin;
    fin.open("input_10500000.txt");
    int aux;
    vector<int> v;
    for(int i=0;i<10500000;i++){
        if(fin.eof()){
            break;
        }
        fin>>aux;
        v.push_back(aux);
    }
    fin.close();
    //v.pop_back();
    qsort(&v[0], v.size(), sizeof(int), compare);
}
