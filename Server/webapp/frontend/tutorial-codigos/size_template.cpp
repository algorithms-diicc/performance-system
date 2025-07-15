#include <iostream>
#include <cstdlib>

// Función recursiva para calcular Fibonacci
long long recursiveFibonacci(int n) {
    if (n <= 1) return n;
    return recursiveFibonacci(n - 1) + recursiveFibonacci(n - 2);
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Uso: ./a.out <tamaño_input>" << std::endl;
        return 1;
    }

    int num = std::atoi(argv[1]);
    recursiveFibonacci(num);

    std::cout << "Fibonacci calculado para n = " << num << std::endl;
    return 0;
}