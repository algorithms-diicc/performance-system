#include <cerrno>
#include <cstdio>
#include <cstdlib>

int main(int argc, char **argv) {
    char *end = nullptr;
    long size;
    volatile unsigned long long checksum = 0;

    if (argc != 2) {
        return 2;
    }

    errno = 0;
    size = std::strtol(argv[1], &end, 10);
    if (errno != 0 || end == argv[1] || *end != '\0' || size < 0) {
        return 3;
    }

    for (long index = 0; index < size; ++index) {
        checksum += (static_cast<unsigned long long>(index) * 2654435761ULL)
            % 1000003ULL;
    }

    std::printf("%llu\n", checksum);
    return 0;
}
