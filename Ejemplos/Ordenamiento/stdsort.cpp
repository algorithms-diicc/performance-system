#include <iostream>
#include <algorithm>
#include <vector>
#include <fstream>
using namespace std;

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
	//cout<<v.size()<<endl;
    //v.pop_back();
	sort(v.begin(), v.end());
	return 0;
}
