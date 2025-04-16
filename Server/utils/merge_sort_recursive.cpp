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

void recursiveMergeSort(std::vector<int>& vec, int left, int right) {
    if (left < right) {
        int mid = left + (right - left) / 2;
        recursiveMergeSort(vec, left, mid);
        recursiveMergeSort(vec, mid + 1, right);
        merge(vec, left, mid, right);
    }
}

int main(int argc, char* argv[]) {
    std::vector<int> values;
    for (int i = 1; i < argc; ++i) {
        values.push_back(std::atoi(argv[i]));
    }

    recursiveMergeSort(values, 0, values.size() - 1);
    // No output as per your request
    return 0;
}
