import argparse
import gzip
import shutil
import subprocess
import sys
from pathlib import Path

import requests


# ============================================================
# RUTAS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

ENGLISH_URL = (
    "https://pizzachili.dcc.uchile.cl/"
    "texts/nlang/english.50MB.gz"
)

ENGLISH_GZ = BASE_DIR / "english.50MB.gz"
ENGLISH_FILE = BASE_DIR / "english.50MB"

GENERATE_NUM_SCRIPT = BASE_DIR / "generate_num.py"


# ============================================================
# DESCARGA
# ============================================================

def download_file(url: str, destination: Path) -> None:
    """
    Descarga un archivo de forma incremental.

    Se utiliza un archivo .part para evitar dejar una descarga
    incompleta con el nombre del archivo definitivo.
    """

    temp_destination = Path(str(destination) + ".part")

    print(f"[DESCARGA] {url}")
    print(f"[DESTINO]  {destination}")

    try:
        with requests.get(
            url,
            stream=True,
            timeout=(10, 120)
        ) as response:

            response.raise_for_status()

            with open(temp_destination, "wb") as output_file:

                for chunk in response.iter_content(
                    chunk_size=1024 * 1024
                ):
                    if chunk:
                        output_file.write(chunk)

        temp_destination.replace(destination)

        print(
            f"[OK] Descarga completada: "
            f"{destination}"
        )

    except Exception:
        if temp_destination.exists():
            temp_destination.unlink()

        raise


# ============================================================
# DESCOMPRESIÓN
# ============================================================

def decompress_gz(
    source: Path,
    destination: Path
) -> None:
    """
    Descomprime un archivo gzip.
    """

    if not source.is_file():
        raise FileNotFoundError(
            f"No existe el archivo comprimido: {source}"
        )

    temp_destination = Path(
        str(destination) + ".part"
    )

    print(
        f"[DESCOMPRESIÓN] {source.name}"
    )

    try:
        with gzip.open(source, "rb") as f_in:
            with open(temp_destination, "wb") as f_out:

                # Esta llamada es correcta.
                shutil.copyfileobj(
                    f_in,
                    f_out
                )

        temp_destination.replace(destination)

        print(
            f"[OK] Dataset creado: "
            f"{destination}"
        )

    except Exception:
        if temp_destination.exists():
            temp_destination.unlink()

        raise


# ============================================================
# DATASET LCS
# ============================================================

def initialize_lcs_input() -> None:
    """
    Inicializa english.50MB.

    Si ya existe, no vuelve a descargarlo.
    """

    print("")
    print("========================================")
    print(" INICIALIZACIÓN DATASET LCS")
    print("========================================")

    if ENGLISH_FILE.is_file():

        size_mb = (
            ENGLISH_FILE.stat().st_size
            / (1024 * 1024)
        )

        print(
            f"[OK] El dataset ya existe:"
        )

        print(
            f"     {ENGLISH_FILE}"
        )

        print(
            f"     tamaño: {size_mb:.2f} MB"
        )

        return


    if not ENGLISH_GZ.is_file():

        download_file(
            ENGLISH_URL,
            ENGLISH_GZ
        )

    else:

        print(
            f"[OK] Comprimido ya existente: "
            f"{ENGLISH_GZ}"
        )


    decompress_gz(
        ENGLISH_GZ,
        ENGLISH_FILE
    )


    # Una vez descomprimido correctamente ya no necesitamos
    # conservar la copia comprimida.
    if ENGLISH_GZ.exists():

        ENGLISH_GZ.unlink()

        print(
            f"[LIMPIEZA] Eliminado: "
            f"{ENGLISH_GZ}"
        )


    size_mb = (
        ENGLISH_FILE.stat().st_size
        / (1024 * 1024)
    )

    print("")
    print(
        f"[OK] Dataset LCS preparado."
    )

    print(
        f"[OK] Ruta: {ENGLISH_FILE}"
    )

    print(
        f"[OK] Tamaño: {size_mb:.2f} MB"
    )


# ============================================================
# INPUTS NUMÉRICOS
# ============================================================

def execute_generate_num(
    option: str,
    size: int
) -> None:

    if not GENERATE_NUM_SCRIPT.is_file():

        raise FileNotFoundError(
            f"No existe: {GENERATE_NUM_SCRIPT}"
        )


    command = [
        sys.executable,
        str(GENERATE_NUM_SCRIPT),
        option,
        str(size)
    ]


    print(
        f"[GENERADOR] "
        f"{' '.join(command)}"
    )


    subprocess.run(
        command,
        cwd=BASE_DIR,
        check=True
    )


def initialize_numeric_inputs(
    size: int = 15000
) -> None:

    print("")
    print("========================================")
    print(" INICIALIZACIÓN INPUTS NUMÉRICOS")
    print("========================================")


    execute_generate_num(
        "r",
        size
    )

    execute_generate_num(
        "s",
        size
    )

    execute_generate_num(
        "so",
        size
    )


    print("")
    print(
        "[OK] Inputs numéricos generados."
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "Inicializa los datasets utilizados "
            "por Performance System."
        )
    )


    group = parser.add_mutually_exclusive_group()


    group.add_argument(
        "--lcs-only",
        action="store_true",
        help=(
            "Descarga únicamente el dataset "
            "english.50MB utilizado por LCS."
        )
    )


    group.add_argument(
        "--numeric-only",
        action="store_true",
        help=(
            "Genera únicamente los inputs "
            "numéricos."
        )
    )


    parser.add_argument(
        "--numeric-size",
        type=int,
        default=15000,
        help=(
            "Cantidad de números a generar "
            "(por defecto: 15000)."
        )
    )


    args = parser.parse_args()


    try:

        if args.lcs_only:

            initialize_lcs_input()


        elif args.numeric_only:

            initialize_numeric_inputs(
                args.numeric_size
            )


        else:

            initialize_lcs_input()

            initialize_numeric_inputs(
                args.numeric_size
            )


    except KeyboardInterrupt:

        print(
            "\n[INTERRUMPIDO] Operación cancelada."
        )

        sys.exit(130)


    except Exception as error:

        print("")
        print(
            "========================================"
        )

        print(
            " ERROR INICIALIZANDO INPUTS"
        )

        print(
            "========================================"
        )

        print(
            f"{type(error).__name__}: {error}"
        )

        sys.exit(1)


if __name__ == "__main__":
    main()