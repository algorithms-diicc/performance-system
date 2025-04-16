
#include <iostream>
#include <cstdlib>

long long recursiveFibonacci(int n) {
    if (n <= 1) return n;
    return recursiveFibonacci(n - 1) + recursiveFibonacci(n - 2);
}

int main(int argc, char* argv[]) {
    if (argc < 2) return 1;
    int num = std::atoi(argv[1]);
    recursiveFibonacci(num);
    return 0;
}
