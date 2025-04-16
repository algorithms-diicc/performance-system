#include <iostream>
#include <sstream>
#include <vector>

void transposeInPlace(std::vector<std::vector<int>>& matrix) {
    size_t n = matrix.size();
    for (size_t i = 0; i < n; ++i) {
        for (size_t j = i + 1; j < n; ++j) {
            std::swap(matrix[i][j], matrix[j][i]);
        }
    }
}

int main(int argc, char* argv[]) {
    int size;
    std::stringstream ss(argv[1]);
    ss >> size;
    
    std::vector<std::vector<int>> matrix(size, std::vector<int>(size));
    int value, row = 0, col = 0;

    for (int i = 2; i < argc; ++i) {
        std::stringstream ss(argv[i]);
        ss >> value;
        matrix[row][col++] = value;
        if (col == size) {
            col = 0;
            row++;
        }
    }

    transposeInPlace(matrix);

    return 0;
}
