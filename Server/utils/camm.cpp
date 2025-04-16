#include <iostream>
#include <vector>
#include <cmath>
#include <sstream>
#include <string>

#define BLOCK_SIZE 32 

void multiply(const std::vector<std::vector<double>>& A,
              const std::vector<std::vector<double>>& B,
              std::vector<std::vector<double>>& C) 
{
    int size = A.size();
    for (int i = 0; i < size; i += BLOCK_SIZE) {
        for (int j = 0; j < size; j += BLOCK_SIZE) {
            for (int k = 0; k < size; k += BLOCK_SIZE) {
                for (int ii = i; ii < i + BLOCK_SIZE && ii < size; ii++) {
                    for (int jj = j; jj < j + BLOCK_SIZE && jj < size; jj++) {
                        for (int kk = k; kk < k + BLOCK_SIZE && kk < size; kk++) {
                            C[ii][jj] += A[ii][kk] * B[kk][jj];
                        }
                    }
                }
            }
        }
    }
}

int main(int argc, char* argv[]) {
    std::vector<double> inputValues;

    // Loop through each argument (skip the program name)
    for (int i = 1; i < argc; ++i) {
        // Convert argument to double and add to the vector
        std::stringstream ss(argv[i]);
        double value;
        while (ss >> value) {
            inputValues.push_back(value);
        }
    }

    // Assuming square matrices
    int size = static_cast<int>(std::sqrt(inputValues.size() / 2));

    std::vector<std::vector<double>> A(size, std::vector<double>(size));
    std::vector<std::vector<double>> B(size, std::vector<double>(size));
    std::vector<std::vector<double>> C(size, std::vector<double>(size, 0.0));

    // Split the input into two matrices
    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++) {
            A[i][j] = inputValues[i * size + j];
            B[i][j] = inputValues[(size * size) + (i * size + j)];
        }
    }

    multiply(A, B, C);

    return 0;
}