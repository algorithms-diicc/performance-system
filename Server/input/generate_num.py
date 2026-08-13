import random
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

BOTTOM_RAND = 0.0
TOP_RAND = 1000.0

# Semilla fija del dataset oficial de desarrollo.
# Permite regenerar exactamente los mismos inputs numéricos.
DEFAULT_SEED = 20260811

OPTION_SEED_OFFSET = {
    "r": 0,
    "s": 1,
    "so": 2,
}

OUTPUT_FILES = {
    "r": "numerical_input.txt",
    "s": "numerical_input_same.txt",
    "so": "numerical_input_semi_sorted.txt",
}


def generate_semi_sorted_numbers(quantity, rng):
    """
    Genera bloques internamente ordenados y luego mezcla el orden
    de los bloques completos.

    La implementación legacy reutilizaba por error el tamaño del
    último bloque para reconstruir todos los rangos. Aquí cada bloque
    conserva su tamaño real.
    """
    max_sorted_range_size = 100
    runs = []
    remaining = quantity

    while remaining > 0:
        size = min(
            rng.randint(1, max_sorted_range_size),
            remaining,
        )

        bottom = rng.uniform(0.0, 500.0)
        top = rng.uniform(bottom, TOP_RAND)

        run = [
            rng.uniform(bottom, top)
            for _ in range(size)
        ]

        run.sort()
        runs.append(run)
        remaining -= size

    rng.shuffle(runs)

    return [
        value
        for run in runs
        for value in run
    ]


def generate_numbers(option, quantity, output_dir=BASE_DIR):
    if option not in OUTPUT_FILES:
        raise ValueError(
            "option debe ser una de: r, s, so"
        )

    if not isinstance(quantity, int) or quantity <= 0:
        raise ValueError(
            "quantity debe ser un entero mayor que 0"
        )

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    seed = (
        DEFAULT_SEED
        + OPTION_SEED_OFFSET[option]
    )

    rng = random.Random(seed)

    filename = output_dir / OUTPUT_FILES[option]

    if option == "r":
        values = [
            rng.uniform(BOTTOM_RAND, TOP_RAND)
            for _ in range(quantity)
        ]

    elif option == "s":
        repeat_num = rng.uniform(
            BOTTOM_RAND,
            TOP_RAND,
        )
        values = [repeat_num] * quantity

    else:
        values = generate_semi_sorted_numbers(
            quantity,
            rng,
        )

    temp_filename = filename.with_suffix(
        filename.suffix + ".part"
    )

    try:
        with open(
            temp_filename,
            "w",
            encoding="utf-8",
            newline="\n",
        ) as output:
            for value in values:
                output.write(
                    f"{value:.2f}\n"
                )

        temp_filename.replace(filename)

    except Exception:
        if temp_filename.exists():
            temp_filename.unlink()
        raise

    print(
        f"File {filename.name} generated with "
        f"{quantity} numbers "
        f"(seed={seed})."
    )

    return filename


def main():
    if len(sys.argv) != 3:
        print(
            "Usage: python generate_num.py "
            "[option] [quantity], "
            "options = [s:same, so:semi ordenado, r:random]"
        )
        return 2

    option = sys.argv[1]

    try:
        quantity = int(sys.argv[2])
        generate_numbers(
            option,
            quantity,
        )

    except (TypeError, ValueError) as error:
        print(
            f"ERROR: {error}",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
