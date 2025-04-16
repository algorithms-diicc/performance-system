#include <iostream>
#include <vector>
#include <algorithm>
#include <random>

int main() {
    // Size constant
    const size_t SIZE = 10000;

    // Vector to store random floats
    std::vector<float> numbers(SIZE);

    // Generate random floats using a random device and Mersenne Twister engine
    std::random_device rd;
    std::mt19937 engine(rd());
    std::uniform_real_distribution<float> distribution(0.0, 1.0);

    for(size_t i = 0; i < SIZE; ++i) {
        numbers[i] = distribution(engine);
    }

    // Bubble Sort
    for (size_t i = 0; i < SIZE - 1; ++i) {
        for (size_t j = 0; j < SIZE - i - 1; ++j) {
            if (numbers[j] > numbers[j + 1]) {
                std::swap(numbers[j], numbers[j + 1]);
            }
        }
    }

    return 0;
}
