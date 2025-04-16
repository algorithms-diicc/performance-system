#include <iostream>
using namespace std;

int main(int argc, char* argv[]) {
    if (argc != 2) {
        cerr << "Usage: " << argv[0] << " <input_size>" << endl;
        return 1;
    }
    
    int input_size = atoi(argv[1]);
    cout << "Generating numbers up to " << input_size << ":\n";
    
    for (int i = 1; i <= input_size; ++i) {
        cout << i << " ";
    }
    cout << endl;

    return 0;
}
