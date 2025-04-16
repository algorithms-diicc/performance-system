#include <iostream>
#include <vector>
#include <cstdlib> // para std::atoi

std::vector<std::vector<int>> multiplyMatrices(const std::vector<std::vector<int>>& a, const std::vector<std::vector<int>>& b) {
    int n = a.size();
    std::vector<std::vector<int>> result(n, std::vector<int>(n, 0));

    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            for (int k = 0; k < n; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }

    return result;
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

    std::vector<std::vector<int>> a(n, std::vector<int>(n)), b(n, std::vector<int>(n));

    // Leer las matrices de los argumentos
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

    std::vector<std::vector<int>> result = multiplyMatrices(a, b);

    // Opcional: imprimir el resultado
    for (const auto& row : result) {
        for (int val : row) {
            std::cout << val << " ";
        }
        std::cout << std::endl;
    }

    return 0;
}
