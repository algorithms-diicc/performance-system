#include <iostream>
#include <vector>
#include <cstdlib> // for atoi

void merge(std::vector<int>& vec, int left, int mid, int right) {
    std::vector<int> temp(right - left + 1);
    int i = left, j = mid + 1, k = 0;

    while (i <= mid && j <= right) {
        if (vec[i] <= vec[j]) {
            temp[k++] = vec[i++];
        } else {
            temp[k++] = vec[j++];
        }
    }

    while (i <= mid) {
        temp[k++] = vec[i++];
    }

    while (j <= right) {
        temp[k++] = vec[j++];
    }

    for (i = left, k = 0; i <= right; ++i, ++k) {
        vec[i] = temp[k];
    }
}

void iterativeMergeSort(std::vector<int>& vec) {
    int n = vec.size();
    for (int size = 1; size <= n - 1; size = 2 * size) {
        for (int left_start = 0; left_start < n - 1; left_start += 2 * size) {
            int mid = std::min(left_start + size - 1, n - 1);
            int right_end = std::min(left_start + 2 * size - 1, n - 1);
            merge(vec, left_start, mid, right_end);
        }
    }
}

int main(int argc, char* argv[]) {
    std::vector<int> values;
    for (int i = 1; i < argc; ++i) {
        values.push_back(std::atoi(argv[i]));
    }

    iterativeMergeSort(values);
    // No output as per your request
    return 0;
}