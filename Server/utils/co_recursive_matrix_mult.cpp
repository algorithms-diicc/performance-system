#include <iostream>
#include <vector>
#include <cstdlib> // para std::atoi

void addMatrix(std::vector<std::vector<int>>& c, const std::vector<std::vector<int>>& a, const std::vector<std::vector<int>>& b, int size) {
    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++) {
            c[i][j] = a[i][j] + b[i][j];
        }
    }
}

void subtractMatrix(std::vector<std::vector<int>>& c, const std::vector<std::vector<int>>& a, const std::vector<std::vector<int>>& b, int size) {
    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++) {
            c[i][j] = a[i][j] - b[i][j];
        }
    }
}

void multiplyRecursive(std::vector<std::vector<int>>& c, const std::vector<std::vector<int>>& a, const std::vector<std::vector<int>>& b, int size) {
    if (size == 1) {
        c[0][0] += a[0][0] * b[0][0];
    } else {
        int newSize = size / 2;
        // ... Implementación recursiva ...
    }
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Uso: " << argv[0] << " n (elementos de la matriz)" << std::endl;
        return 1;
    }

    int n = std::atoi(argv[1]);
    if (argc != 1 + 2 * n * n) {
        std::cerr << "Número incorrecto de argumentos para una matriz de tamaño " << n << std::endl;
        return 1;
    }

    std::vector<std::vector<int>> a(n, std::vector<int>(n)), b(n, std::vector<int>(n)), c(n, std::vector<int>(n, 0));

    int index = 2; // Comenzar después del tamaño de la matriz
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            a[i][j] = std::atoi(argv[index++]);
        }
    }
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            b[i][j] = std::atoi(argv[index++]);
        }
    }

    multiplyRecursive(c, a, b, n);

    // Opcional: imprimir el resultado
    // ...

    return 0;
}
