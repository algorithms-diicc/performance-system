#include <iostream>
#include <algorithm>
#include <string>
#include <fstream>
using namespace std;

int main(){
	string s;
	fstream fin("caracteres.txt");
	fin>>s;
	fin.close();
	ofstream fout("test.txt");
	replace(s.begin(), s.end(), 'a', 'A');
	replace(s.begin(), s.end(), 'j', 'J');
	replace(s.begin(), s.end(), 'x', 'X');
	fout<<s<<endl;
	fout.close();
	return 0;
}