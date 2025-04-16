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

    // Sort the vector
    std::sort(numbers.begin(), numbers.end());

    return 0;
}
