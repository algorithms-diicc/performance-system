#include <iostream>
#include <vector>
#include <cstdlib>  // for atoi

long long recursiveFibonacci(int n) {
    if (n <= 1) return n;
    return recursiveFibonacci(n - 1) + recursiveFibonacci(n - 2);
}

int main(int argc, char* argv[]) {
    for (int i = 1; i < argc; ++i) {
        int num = std::atoi(argv[i]);
        // Calcula el enésimo número de Fibonacci, no se imprime nada
        recursiveFibonacci(num);
    }
    return 0;
}
