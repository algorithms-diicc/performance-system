#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    char *end = NULL;
    long size;
    volatile unsigned long long checksum = 0;

    if (argc != 2) {
        return 2;
    }

    errno = 0;
    size = strtol(argv[1], &end, 10);
    if (errno != 0 || end == argv[1] || *end != '\0' || size < 0) {
        return 3;
    }

    for (long index = 0; index < size; ++index) {
        checksum += ((unsigned long long)index * 2654435761ULL) % 1000003ULL;
    }

    printf("%llu\n", checksum);
    return 0;
}
