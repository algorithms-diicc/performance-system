#!/usr/bin/env python3
"""
Validador independiente para UI-03B-2.

Objetivos:
1) Verificar que CombinedResults.csv conserva correctamente las métricas base.
2) Recalcular desde Results0.csv las métricas derivadas fila a fila:
   - IPC
   - CacheMissRate
   - BranchMissRate
   - BranchMissesPerMI
   - CacheMissesPerMI
3) Recalcular SIN pandas las estadísticas IQR publicadas por la API:
   - mean
   - median
   - sample stddev
   - samples_total
   - samples_valid
   - outliers_removed
   - iqr_applied
4) Verificar estados de disponibilidad (available / partial / unsupported / no_data).

El script usa exclusivamente la biblioteca estándar de Python para que la
validación no dependa de la implementación de results_service.py ni de pandas.
"""

import argparse
import csv
import json
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


UNSUPPORTED_MARKERS = {
    "<not-supported>",
    "<not supported>",
}

NOT_COUNTED_MARKERS = {
    "<not-counted>",
    "<not counted>",
}

META_COLUMNS = {
    "Increment",
    "InputSize",
    "StartTime",
    "EndTime",
    # CORE-06B-4: auxiliares del raw, no métricas públicas.
    "NormalizedInstructions",
    "NormalizedCacheMisses",
    "source",
}

DERIVED_METRICS = {
    "IPC": ("Instructions", "CpuCycles", "ratio"),
    "CacheMissRate": ("CacheMisses", "CacheReferences", "ratio"),
    "BranchMissRate": ("BranchMisses", "Branches", "ratio"),
    "BranchMissesPerMI": ("BranchMisses", "Instructions", "per_million"),
    "CacheMissesPerMI": ("NormalizedCacheMisses", "NormalizedInstructions", "per_million"),  # CORE-06B-4
}

IQR_MULTIPLIER = 1.5
MIN_SAMPLES_FOR_IQR = 5


class ValidationFailure(Exception):
    pass


def parse_args():
    parser = argparse.ArgumentParser(
        description="Valida la API JSON de resultados contra los CSV reales."
    )
    parser.add_argument(
        "--codename",
        required=True,
        help="Identificador de ejecución, por ejemplo 9868247794LCS.",
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:5000",
        help="URL base del backend Flask/Gunicorn.",
    )
    parser.add_argument(
        "--static-dir",
        default="Server/webapp/static",
        help="Directorio static del backend, relativo al cwd o absoluto.",
    )
    parser.add_argument(
        "--rel-tol",
        type=float,
        default=1e-10,
        help="Tolerancia relativa para comparaciones flotantes.",
    )
    parser.add_argument(
        "--abs-tol",
        type=float,
        default=1e-10,
        help="Tolerancia absoluta para comparaciones flotantes.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Muestra cada check individual; por defecto imprime un resumen compacto.",
    )
    return parser.parse_args()


def read_csv_rows(path):
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def fetch_api_json(base_url, codename):
    url = "{}/api/executions/{}/results".format(
        base_url.rstrip("/"),
        codename,
    )

    try:
        with urlopen(url, timeout=20) as response:
            status = getattr(response, "status", response.getcode())
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise ValidationFailure(
            "La API respondió HTTP {}: {}".format(exc.code, body)
        )
    except URLError as exc:
        raise ValidationFailure(
            "No fue posible conectar con {}: {}".format(url, exc)
        )

    if status != 200:
        raise ValidationFailure(
            "La API respondió HTTP {}.".format(status)
        )

    try:
        return json.loads(body)
    except ValueError as exc:
        raise ValidationFailure(
            "La API no devolvió JSON válido: {}".format(exc)
        )


def normalize_text(value):
    return str(value if value is not None else "").strip()


def to_number(value):
    text = normalize_text(value)
    lowered = text.lower()

    if (
        not text
        or lowered in {"nan", "none", "null"}
        or lowered in UNSUPPORTED_MARKERS
        or lowered in NOT_COUNTED_MARKERS
    ):
        return None

    try:
        number = float(text)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(number):
        return None

    return number


def same_number(expected, actual, rel_tol, abs_tol):
    if expected is None and actual is None:
        return True

    if expected is None or actual is None:
        return False

    try:
        return math.isclose(
            float(expected),
            float(actual),
            rel_tol=rel_tol,
            abs_tol=abs_tol,
        )
    except (TypeError, ValueError):
        return False


def percentile_linear(values, q):
    """
    Percentil con interpolación lineal compatible con el comportamiento
    histórico usado por pandas.Series.quantile(interpolation="linear").
    """
    ordered = sorted(values)
    n = len(ordered)

    if n == 0:
        return None

    if n == 1:
        return ordered[0]

    position = (n - 1) * q
    lower_index = int(math.floor(position))
    upper_index = int(math.ceil(position))

    if lower_index == upper_index:
        return ordered[lower_index]

    fraction = position - lower_index

    return (
        ordered[lower_index] * (1.0 - fraction)
        + ordered[upper_index] * fraction
    )


def independent_iqr_statistics(values):
    numeric = [
        float(value)
        for value in values
        if value is not None and math.isfinite(float(value))
    ]

    samples_total = len(numeric)

    if samples_total == 0:
        return {
            "mean": None,
            "median": None,
            "stddev": None,
            "samples_total": 0,
            "samples_valid": 0,
            "outliers_removed": 0,
            "iqr_applied": False,
        }

    if samples_total < MIN_SAMPLES_FOR_IQR:
        filtered = list(numeric)
        iqr_applied = False
    else:
        q1 = percentile_linear(numeric, 0.25)
        q3 = percentile_linear(numeric, 0.75)
        iqr = q3 - q1

        lower = q1 - IQR_MULTIPLIER * iqr
        upper = q3 + IQR_MULTIPLIER * iqr

        filtered = [
            value
            for value in numeric
            if lower <= value <= upper
        ]

        # CORE-06B-2/4: si el filtrado deja menos del mínimo científico,\n        # se conserva la muestra original y se informa IQR no aplicado.\n        if len(filtered) < MIN_SAMPLES_FOR_IQR:\n            filtered = list(numeric)\n            iqr_applied = False\n        else:\n            iqr_applied = True

    mean_value = statistics.fmean(filtered)
    median_value = statistics.median(filtered)
    stddev_value = (
        statistics.stdev(filtered)
        if len(filtered) > 1
        else None
    )

    return {
        "mean": mean_value,
        "median": median_value,
        "stddev": stddev_value,
        "samples_total": samples_total,
        "samples_valid": len(filtered),
        "outliers_removed": samples_total - len(filtered),
        "iqr_applied": iqr_applied,
    }


def classify_values(rows, metric):
    result = {
        "numeric": 0,
        "unsupported": 0,
        "not_counted": 0,
        "missing": 0,
    }

    for row in rows:
        text = normalize_text(row.get(metric))
        lowered = text.lower()

        if not text or lowered in {"nan", "none", "null"}:
            result["missing"] += 1
            continue

        if lowered in UNSUPPORTED_MARKERS:
            result["unsupported"] += 1
            continue

        if lowered in NOT_COUNTED_MARKERS:
            result["not_counted"] += 1
            continue

        if to_number(text) is None:
            result["missing"] += 1
        else:
            result["numeric"] += 1

    return result


def derive_status(
    numeric_total,
    unsupported_total,
    not_counted_total,
    missing_total,
    groups_total,
    groups_with_data,
):
    if numeric_total == 0:
        if (
            unsupported_total > 0
            and not_counted_total == 0
            and missing_total == 0
        ):
            return "unsupported"

        return "no_data"

    if (
        unsupported_total > 0
        or not_counted_total > 0
        or missing_total > 0
        or groups_with_data < groups_total
    ):
        return "partial"

    return "available"


def row_identity(row):
    return (
        normalize_text(row.get("Increment")),
        normalize_text(row.get("InputSize")),
    )


def validate_raw_to_combined(raw_rows, combined_rows, rel_tol, abs_tol):
    checks = []

    if len(raw_rows) != len(combined_rows):
        return [
            (
                "Filas Results0 → CombinedResults",
                False,
                "{} vs {}".format(len(raw_rows), len(combined_rows)),
            )
        ]

    checks.append(
        (
            "Cantidad de filas",
            True,
            "",
        )
    )

    # Results0.csv y CombinedResults.csv mantienen el mismo orden de muestras.
    # No usamos (Increment, InputSize) como clave única porque con INCREMENTS=1
    # las 30 repeticiones comparten ambos valores.
    paired_rows = list(zip(raw_rows, combined_rows))

    # 1) Identidad básica por posición.
    identity_ok = True
    identity_detail = ""

    for index, (raw_row, combined_row) in enumerate(paired_rows, start=1):
        if row_identity(raw_row) != row_identity(combined_row):
            identity_ok = False
            identity_detail = (
                "Fila {}: Results0={} Combined={}".format(
                    index,
                    row_identity(raw_row),
                    row_identity(combined_row),
                )
            )
            break

    checks.append(
        (
            "Orden/identidad de muestras",
            identity_ok,
            identity_detail,
        )
    )

    # 2) Campos base que no deberían cambiar de significado.
    base_columns = [
        "InputSize",
        "Instructions",
        "CpuCycles",
        "CacheReferences",
        "CacheMisses",
        "Branches",
        "BranchMisses",
        "L1DcacheLoads",
        "L1DcacheLoadMisses",
        "DurationTime",
    ]

    for column in base_columns:
        ok = True
        detail = ""

        for index, (raw_row, combined_row) in enumerate(
            paired_rows,
            start=1,
        ):
            expected = to_number(raw_row.get(column))
            actual = to_number(combined_row.get(column))

            if not same_number(
                expected,
                actual,
                rel_tol,
                abs_tol,
            ):
                ok = False
                detail = (
                    "{} fila {}: esperado={!r}, actual={!r}".format(
                        column,
                        index,
                        expected,
                        actual,
                    )
                )
                break

        checks.append(
            (
                "Métrica base {}".format(column),
                ok,
                detail,
            )
        )

    # 3) Métricas derivadas recalculadas desde Results0.
    for metric, (numerator, denominator, mode) in DERIVED_METRICS.items():
        ok = True
        detail = ""

        # CORE-06B-4: raws históricos no tienen pareja simultánea.
        if (
            metric == "CacheMissesPerMI"
            and paired_rows
            and (
                numerator not in paired_rows[0][0]
                or denominator not in paired_rows[0][0]
            )
        ):
            checks.append(
                (
                    "Derivada {} (legacy no evaluable)".format(metric),
                    True,
                    "raw histórico sin pareja simultánea",
                )
            )
            continue

        for index, (raw_row, combined_row) in enumerate(
            paired_rows,
            start=1,
        ):
            numerator_value = to_number(raw_row.get(numerator))
            denominator_value = to_number(raw_row.get(denominator))

            expected = None

            if (
                numerator_value is not None
                and denominator_value is not None
                and denominator_value != 0
            ):
                if mode == "ratio":
                    expected = numerator_value / denominator_value
                elif mode == "per_million":
                    if denominator_value > 0:
                        expected = (
                            numerator_value / denominator_value
                        ) * 1_000_000.0

            actual = to_number(combined_row.get(metric))

            if not same_number(
                expected,
                actual,
                rel_tol,
                abs_tol,
            ):
                ok = False
                detail = (
                    "{} fila {}: esperado={!r}, actual={!r}".format(
                        metric,
                        index,
                        expected,
                        actual,
                    )
                )
                break

        checks.append(
            (
                "Derivada {}".format(metric),
                ok,
                detail,
            )
        )

    return checks


def build_groups(rows):
    groups = defaultdict(list)

    for row in rows:
        source = normalize_text(row.get("source"))
        input_size = normalize_text(row.get("InputSize"))
        groups[(source, input_size)].append(row)

    return groups


def normalized_input_size(value):
    number = to_number(value)

    if number is None:
        return None

    if float(number).is_integer():
        return int(number)

    return float(number)


def find_api_point(points, source, input_size):
    for point in points:
        point_source = normalize_text(point.get("source"))
        point_input = point.get("input_size")

        if point_source != source:
            continue

        expected_input = normalized_input_size(input_size)

        if (
            expected_input is None
            and point_input is None
        ):
            return point

        if same_number(
            expected_input,
            point_input,
            0.0,
            0.0,
        ):
            return point

    return None


def validate_api_statistics(
    api_payload,
    combined_rows,
    rel_tol,
    abs_tol,
):
    checks = []

    if api_payload.get("schema_version") != "1.0":
        checks.append(
            (
                "schema_version",
                False,
                "Esperado 1.0, recibido {!r}".format(
                    api_payload.get("schema_version")
                ),
            )
        )
    else:
        checks.append(
            ("schema_version", True, "")
        )

    api_metrics = api_payload.get("metrics")

    if not isinstance(api_metrics, dict):
        return checks + [
            (
                "Bloque metrics",
                False,
                "La respuesta no contiene metrics válido.",
            )
        ]

    groups = build_groups(combined_rows)
    metric_names = [
        column
        for column in combined_rows[0].keys()
        if column not in META_COLUMNS
    ]

    for metric in metric_names:
        api_metric = api_metrics.get(metric)

        if not isinstance(api_metric, dict):
            checks.append(
                (
                    "API {}".format(metric),
                    False,
                    "Métrica ausente en el JSON.",
                )
            )
            continue

        availability_total = {
            "numeric": 0,
            "unsupported": 0,
            "not_counted": 0,
            "missing": 0,
        }

        groups_with_data = 0

        for group_rows in groups.values():
            availability = classify_values(
                group_rows,
                metric,
            )

            for key in availability_total:
                availability_total[key] += availability[key]

            if availability["numeric"] > 0:
                groups_with_data += 1

        expected_status = derive_status(
            numeric_total=availability_total["numeric"],
            unsupported_total=availability_total["unsupported"],
            not_counted_total=availability_total["not_counted"],
            missing_total=availability_total["missing"],
            groups_total=len(groups),
            groups_with_data=groups_with_data,
        )

        actual_status = api_metric.get("status")

        checks.append(
            (
                "{} status".format(metric),
                actual_status == expected_status,
                (
                    ""
                    if actual_status == expected_status
                    else "Esperado {}, recibido {}".format(
                        expected_status,
                        actual_status,
                    )
                ),
            )
        )

        api_availability = api_metric.get(
            "availability",
            {},
        )

        expected_availability = {
            "rows_total": len(combined_rows),
            "numeric": availability_total["numeric"],
            "unsupported": availability_total["unsupported"],
            "not_counted": availability_total["not_counted"],
            "missing": availability_total["missing"],
            "groups_total": len(groups),
            "groups_with_data": groups_with_data,
        }

        availability_ok = all(
            api_availability.get(key) == value
            for key, value in expected_availability.items()
        )

        checks.append(
            (
                "{} availability".format(metric),
                availability_ok,
                (
                    ""
                    if availability_ok
                    else "Esperado {}, recibido {}".format(
                        expected_availability,
                        api_availability,
                    )
                ),
            )
        )

        api_points = api_metric.get("points", [])

        expected_point_count = groups_with_data

        checks.append(
            (
                "{} points".format(metric),
                len(api_points) == expected_point_count,
                (
                    ""
                    if len(api_points) == expected_point_count
                    else "Esperado {}, recibido {}".format(
                        expected_point_count,
                        len(api_points),
                    )
                ),
            )
        )

        for (source, input_size), group_rows in groups.items():
            numeric_values = [
                to_number(row.get(metric))
                for row in group_rows
            ]
            numeric_values = [
                value
                for value in numeric_values
                if value is not None
            ]

            if not numeric_values:
                continue

            expected_stats = independent_iqr_statistics(
                numeric_values
            )

            point = find_api_point(
                api_points,
                source,
                input_size,
            )

            if point is None:
                checks.append(
                    (
                        "{} stats {} / {}".format(
                            metric,
                            source or "(sin source)",
                            input_size,
                        ),
                        False,
                        "Punto ausente en API.",
                    )
                )
                continue

            numeric_fields = (
                "mean",
                "median",
                "stddev",
            )

            ok = True
            detail = ""

            for field in numeric_fields:
                if not same_number(
                    expected_stats[field],
                    point.get(field),
                    rel_tol,
                    abs_tol,
                ):
                    ok = False
                    detail = (
                        "{}: esperado={!r}, recibido={!r}".format(
                            field,
                            expected_stats[field],
                            point.get(field),
                        )
                    )
                    break

            if ok:
                integer_fields = (
                    "samples_total",
                    "samples_valid",
                    "outliers_removed",
                )

                for field in integer_fields:
                    if (
                        expected_stats[field]
                        != point.get(field)
                    ):
                        ok = False
                        detail = (
                            "{}: esperado={!r}, recibido={!r}".format(
                                field,
                                expected_stats[field],
                                point.get(field),
                            )
                        )
                        break

            if ok and (
                expected_stats["iqr_applied"]
                != point.get("iqr_applied")
            ):
                ok = False
                detail = (
                    "iqr_applied: esperado={!r}, recibido={!r}".format(
                        expected_stats["iqr_applied"],
                        point.get("iqr_applied"),
                    )
                )

            checks.append(
                (
                    "{} stats {} / {}".format(
                        metric,
                        source or "(sin source)",
                        input_size,
                    ),
                    ok,
                    detail,
                )
            )

    return checks


def detect_provenance_warnings(raw_rows, combined_rows):
    warnings = []

    if not raw_rows or not combined_rows:
        return warnings

    for metric in raw_rows[0].keys():
        if metric not in combined_rows[0]:
            continue

        raw_not_counted = sum(
            1
            for row in raw_rows
            if normalize_text(row.get(metric)).lower()
            in NOT_COUNTED_MARKERS
        )

        combined_not_counted = sum(
            1
            for row in combined_rows
            if normalize_text(row.get(metric)).lower()
            in NOT_COUNTED_MARKERS
        )

        combined_missing = sum(
            1
            for row in combined_rows
            if not normalize_text(row.get(metric))
        )

        if (
            raw_not_counted > 0
            and combined_not_counted < raw_not_counted
            and combined_missing > 0
        ):
            warnings.append(
                (
                    metric,
                    raw_not_counted,
                    combined_not_counted,
                    combined_missing,
                )
            )

    return warnings


def print_section(title):
    print("")
    print(title)
    print("=" * len(title))


def print_checks(checks, verbose=False):
    passed = 0

    for name, ok, detail in checks:
        if ok:
            passed += 1

        if verbose or not ok:
            status = "PASS" if ok else "FAIL"
            print("{:<48} {}".format(name, status))

            if detail and not ok:
                print("  -> {}".format(detail))

    print(
        "Resumen: {}/{} checks passed".format(
            passed,
            len(checks),
        )
    )

    return passed, len(checks)


def main():
    args = parse_args()

    static_dir = Path(args.static_dir)
    codename = args.codename

    combined_path = (
        static_dir
        / codename
        / "CombinedResults.csv"
    )

    raw_path = (
        static_dir
        / "{}Results0.csv".format(codename)
    )

    if not combined_path.is_file():
        print(
            "ERROR: no existe {}".format(
                combined_path
            ),
            file=sys.stderr,
        )
        return 2

    if not raw_path.is_file():
        print(
            "ERROR: no existe {}".format(
                raw_path
            ),
            file=sys.stderr,
        )
        return 2

    try:
        api_payload = fetch_api_json(
            args.base_url,
            codename,
        )
    except ValidationFailure as exc:
        print(
            "ERROR: {}".format(exc),
            file=sys.stderr,
        )
        return 2

    raw_rows = read_csv_rows(raw_path)
    combined_rows = read_csv_rows(
        combined_path
    )

    if not raw_rows or not combined_rows:
        print(
            "ERROR: uno de los CSV está vacío.",
            file=sys.stderr,
        )
        return 2

    print("PERFORMANCE SYSTEM — RESULTS VALIDATION")
    print("Execution: {}".format(codename))
    print("API: {}".format(args.base_url))
    print(
        "Results0 rows: {} | CombinedResults rows: {}".format(
            len(raw_rows),
            len(combined_rows),
        )
    )

    print_section(
        "1. Results0 → CombinedResults"
    )

    pipeline_checks = validate_raw_to_combined(
        raw_rows,
        combined_rows,
        args.rel_tol,
        args.abs_tol,
    )

    passed_pipeline, total_pipeline = print_checks(
        pipeline_checks,
        verbose=args.verbose,
    )

    print_section(
        "2. CombinedResults → JSON API"
    )

    api_checks = validate_api_statistics(
        api_payload,
        combined_rows,
        args.rel_tol,
        args.abs_tol,
    )

    passed_api, total_api = print_checks(
        api_checks,
        verbose=args.verbose,
    )

    warnings = detect_provenance_warnings(
        raw_rows,
        combined_rows,
    )

    print_section("3. Observaciones")

    if warnings:
        for (
            metric,
            raw_not_counted,
            combined_not_counted,
            combined_missing,
        ) in warnings:
            print(
                "WARN {:<28} Results0 tiene {} <not-counted>, "
                "Combined conserva {} y convierte {} a vacío.".format(
                    metric,
                    raw_not_counted,
                    combined_not_counted,
                    combined_missing,
                )
            )

        print(
            "\nEsta advertencia NO invalida las estadísticas numéricas. "
            "Indica pérdida de procedencia del motivo de indisponibilidad "
            "entre Results0.csv y CombinedResults.csv."
        )
    else:
        print(
            "No se detectó pérdida de marcadores <not-counted>."
        )

    total_passed = (
        passed_pipeline + passed_api
    )
    total_checks = (
        total_pipeline + total_api
    )

    print_section("RESULTADO")

    print(
        "{}/{} checks passed".format(
            total_passed,
            total_checks,
        )
    )

    if total_passed == total_checks:
        print("RESULT: PASS")

        if warnings:
            print(
                "RESULT WITH WARNINGS: revisar procedencia "
                "de marcadores no contados en una etapa posterior."
            )

        return 0

    print("RESULT: FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(main())