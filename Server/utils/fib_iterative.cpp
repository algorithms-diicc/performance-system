#include <iostream>
#include <vector>
#include <cstdlib>  // for atoi

long long iterativeFibonacci(int n) {
    if (n <= 1) return n;
    long long a = 0, b = 1, c;
    for (int i = 2; i <= n; ++i) {
        c = a + b;
        a = b;
        b = c;
    }
    return b;
}

int main(int argc, char* argv[]) {
    for (int i = 1; i < argc; ++i) {
        int num = std::atoi(argv[i]);
        // Calcula el enésimo número de Fibonacci, no se imprime nada
        iterativeFibonacci(num);
    }
    return 0;
}
