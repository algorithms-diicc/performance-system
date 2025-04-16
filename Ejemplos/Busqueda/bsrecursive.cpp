#include <vector>
#include <iostream>
#include <fstream>

using namespace std;

int BBrecursivo(vector<int> array, int valor, int l, int r){
	int mitad = (l+r)/2;
	if(array[mitad] != valor && l>=r){
		return -1;
	}
	if(array[mitad] == valor){
		return mitad;
	}else if(valor > array[mitad]){
		return BBrecursivo(array,valor,mitad+1,r);
	}else{
		return BBrecursivo(array,valor,l,mitad-1);
	}
	
}

int main(){
	//int *array = (int *) malloc(sizeof(int)*size);
	vector<int> v;
	int i, aux, temp, l=0, r;
	ifstream fin("input_10500000_sorted.txt");
	for(i=0;i<10500000;i++){
		if(fin.eof()){
            break;
        }
		fin>>aux;
		v.push_back(aux);
	}
	r = v.size();
	srand(time(NULL));
	temp = 6224206;
	//temp = 4389578;
	cout<<"temp("<<temp<<") found at: "<<BBrecursivo(v,temp,l,r)<<endl;
	return 0;
}