#include <iostream>
#include <vector>
#include <cstdlib> // for atoi

void bubblesort(std::vector<int>& vec) {
    bool swapped;
    do {
        swapped = false;
        for (size_t i = 1; i < vec.size(); ++i) {
            if (vec[i - 1] > vec[i]) {
                std::swap(vec[i - 1], vec[i]);
                swapped = true;
            }
        }
    } while (swapped);
}

int main(int argc, char* argv[]) {
    std::vector<int> values;
    for (int i = 1; i < argc; ++i) {
        values.push_back(std::atoi(argv[i]));
    }

    bubblesort(values);
    return 0;
}
