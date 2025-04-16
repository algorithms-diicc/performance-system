#include <iostream>
#include <vector>
#include <algorithm>

int main(int argc, char* argv[]) {
    std::vector<int> numbers;

    // Loop through each argument (skip the program name)
    for (int i = 1; i < argc; ++i) {
        // Convert argument to integer and add to the vector
        numbers.push_back(std::stoi(argv[i]));
    }
    // Sort the numbers
    std::sort(numbers.begin(), numbers.end());


    return 0;
}
