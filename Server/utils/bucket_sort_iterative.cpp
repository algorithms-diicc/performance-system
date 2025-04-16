#include <algorithm>
#include <vector>
#include <iostream>

void bucketSort(std::vector<float>& arr) {
    int n = arr.size();
    std::vector<float> b[n];

    // Poner elementos en diferentes buckets
    for (int i = 0; i < n; i++) {
        int bi = n * arr[i]; // Índice en el bucket
        b[bi].push_back(arr[i]);
    }

    // Ordenar los buckets individualmente
    for (int i = 0; i < n; i++) {
        std::sort(b[i].begin(), b[i].end());
    }

    // Concatenar todos los buckets en arr
    int index = 0;
    for (int i = 0; i < n; i++) {
        for (float j : b[i]) {
            arr[index++] = j;
        }
    }
}

int main(int argc, char* argv[]) {
   std::vector<float> arr;
    for (int i = 1; i < argc; i++) {
        arr.push_back(std::atof(argv[i]));
    }

    bucketSort(arr);

    // Si deseas imprimir el array ordenado para verificar, puedes descomentar la siguiente parte
    /*
    for (int i = 0; i < arr.size(); i++) {
        std::cout << arr[i] << " ";
    }
    */

    return 0;
}
