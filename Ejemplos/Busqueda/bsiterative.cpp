#include <iostream>
#include <vector>
#include <fstream>

using namespace std;

int BBIterativo(vector<int> &array, int valor){
	int mitad, l = 0, r = array.size() - 1;
	while(l<=r){
		mitad = (l+r)/2;
		if(array[mitad] == valor){
			return mitad;
		}else if(valor > array[mitad]){
			l = mitad + 1;
		}else{
			r = mitad - 1;
		}
	}
	return -1;
}

int main(){
	//int *array = (int *) malloc(sizeof(int)*size);
	vector<int> v;
	int i,aux,temp;

	ifstream fin("input_10500000_sorted.txt");

	for(i=0;i<10500000;i++){
		if(fin.eof()){
            break;
        }
		fin>>aux;
		v.push_back(aux);
	}
	srand(time(NULL));
	temp = rand() % v.size() + 1;
	//temp = 4389578;
	cout<<"temp("<<temp<<") found at: "<<BBIterativo(v,temp)<<endl;
	
	return 0;
}