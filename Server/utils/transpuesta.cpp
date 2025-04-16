#include <iostream>
#include <sstream>
#include <vector>

std::vector<std::vector<int>> transpose(const std::vector<std::vector<int>>& matrix) {
    size_t rows = matrix.size();
    size_t cols = matrix[0].size();
    std::vector<std::vector<int>> transposed(cols, std::vector<int>(rows));

    for (size_t i = 0; i < rows; ++i) {
        for (size_t j = 0; j < cols; ++j) {
            transposed[j][i] = matrix[i][j];
        }
    }

    return transposed;
}

int main(int argc, char* argv[]) {
    int rows, cols;
    std::stringstream ss(argv[1]);
    ss >> rows >> cols;
    
    std::vector<std::vector<int>> matrix(rows, std::vector<int>(cols));
    int value, row = 0, col = 0;

    for (int i = 2; i < argc; ++i) {
        std::stringstream ss(argv[i]);
        ss >> value;
        matrix[row][col++] = value;
        if (col == cols) {
            col = 0;
            row++;
        }
    }

    std::vector<std::vector<int>> transposed = transpose(matrix);

    return 0;
}
