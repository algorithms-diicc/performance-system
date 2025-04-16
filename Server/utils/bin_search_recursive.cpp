#include <iostream>
#include <algorithm>
#include <vector>
#include <cstdlib>

// Función de búsqueda binaria recursiva para float
float binarySearch(const std::vector<float>& arr, float left, float right, float value) {
    if (right >= left) {
        float mid = left + (right - left) / 2;

        // Si el elemento está presente en el medio
        if (arr[mid] == value) 
            return mid;

        // Si el elemento es menor que el medio, entonces 
        // solo puede estar presente en el subarray izquierdo
        if (arr[mid] > value) 
            return binarySearch(arr, left, mid - 1, value);

        // De lo contrario, el elemento solo puede estar presente
        // en el subarray derecho
        return binarySearch(arr, mid + 1, right, value);
    }

    // Elemento no está presente en el array
    return -1;
}

int main(int argc, char** argv) {
    std::vector<float> arr;

    // Convertir argumentos a float y agregarlos al vector
    for (int i = 1; i < argc - 1; ++i) {
        arr.push_back(std::stof(argv[i]));
    }

    // Valor a buscar
    float valueToSearch = -1.0f;

    // Ordenar el array (necesario para la búsqueda binaria)
    std::sort(arr.begin(), arr.end());

    // Realizar la búsqueda binaria
    float result = binarySearch(arr, 0, arr.size() - 1, valueToSearch);


    return 0;
}
