"""Comparación determinista de resultados científicos ya estructurados."""

import math
from pathlib import PurePosixPath
import re


SCHEMA_VERSION = "1.0"
TARGET_METRICS = (
    "DurationTime",
    "IPC",
    "CacheMissRate",
    "BranchMissRate",
    "EnergyPkg",
)
REQUIRED_PROTOCOL_FIELDS = (
    ("schema_version", "schemaVersion"),
    ("points", "points"),
    ("samples_per_point", "samplesPerPoint"),
    ("warmup_rounds", "warmupRounds"),
    ("perf_scope", "perfScope"),
    ("single_event_fallback", "singleEventFallback"),
)
DIMENSION_ORDER = {
    "benchmark": 0,
    "hardware": 1,
    "measurementBackend": 2,
    "profile": 3,
    "protocol": 4,
    "compilerFlags": 5,
    "sourceProvenance": 6,
    "inputSizes": 7,
    "metrics": 8,
}
WHITESPACE_RE = re.compile(r"\s+")


class ComparisonResultsInvalid(ValueError):
    """Los resultados estructurados no cumplen el contrato mínimo."""


def build_comparison(execution_contexts, results_payloads):
    """Construye el contrato público de comparación sin volver a medir.

    ``execution_contexts`` y ``results_payloads`` deben conservar el mismo
    orden que ``request.executions``. La función no consulta permisos, DB,
    filesystem, reloj ni servicios externos.
    """
    contexts = _validated_sequence(execution_contexts, "execution_contexts")
    results = _validated_sequence(results_payloads, "results_payloads")
    if len(contexts) != len(results) or not 2 <= len(contexts) <= 4:
        raise ComparisonResultsInvalid(
            "La comparación requiere entre dos y cuatro ejecuciones alineadas."
        )

    normalized = [
        _normalize_execution_context(context)
        for context in contexts
    ]
    metric_maps = [_validated_metric_map(payload) for payload in results]

    blockers = []
    warnings = []
    dimensions = {}

    dimensions["benchmark"] = _benchmark_gate(normalized, blockers)
    dimensions["hardware"] = _hardware_gate(normalized, blockers)
    dimensions["measurementBackend"] = _measurement_backend_gate(
        normalized,
        blockers,
        warnings,
    )
    dimensions["profile"] = _profile_gate(normalized, blockers)
    dimensions["protocol"] = _protocol_gate(normalized, blockers)
    dimensions["compilerFlags"] = _compiler_flags_gate(
        normalized,
        blockers,
    )
    dimensions["sourceProvenance"] = _provenance_gate(
        metric_maps,
        blockers,
    )

    measured_input_sizes = [
        set(_numeric_metric_points(metrics.get("DurationTime")))
        for metrics in metric_maps
    ]
    input_size_result = _input_size_gate(
        normalized,
        measured_input_sizes,
        blockers,
        warnings,
    )
    dimensions["inputSizes"] = input_size_result["dimension"]
    common_input_sizes = input_size_result["commonInputSizes"]
    input_coverage = input_size_result["inputCoverage"]

    metric_result = _build_metrics(
        normalized,
        metric_maps,
        common_input_sizes,
        blockers,
        warnings,
    )
    dimensions["metrics"] = metric_result["dimension"]

    blockers = _sorted_issues(blockers)
    warnings = _sorted_issues(warnings)
    if blockers:
        status = "INCOMPATIBLE"
    elif warnings:
        status = "LIMITED"
    else:
        status = "COMPATIBLE"

    return {
        "schemaVersion": SCHEMA_VERSION,
        "compatibility": {
            "status": status,
            "blockers": blockers,
            "warnings": warnings,
            "dimensions": dimensions,
            "commonInputSizes": common_input_sizes,
            "inputCoverage": input_coverage,
            "commonMetrics": metric_result["commonMetrics"],
            "excludedMetrics": metric_result["excludedMetrics"],
        },
        "executions": [item["public"] for item in normalized],
        "metrics": (
            {}
            if status == "INCOMPATIBLE"
            else metric_result["metrics"]
        ),
    }


def _validated_sequence(value, name):
    if not isinstance(value, (list, tuple)):
        raise ComparisonResultsInvalid("{} debe ser una secuencia.".format(name))
    return list(value)


def _validated_metric_map(payload):
    if not isinstance(payload, dict):
        raise ComparisonResultsInvalid(
            "Los resultados estructurados deben ser objetos."
        )
    metrics = payload.get("metrics")
    if not isinstance(metrics, dict):
        raise ComparisonResultsInvalid(
            "Los resultados estructurados no contienen métricas válidas."
        )
    for metric_name, metric in metrics.items():
        if not isinstance(metric_name, str) or not isinstance(metric, dict):
            raise ComparisonResultsInvalid(
                "El contrato de métricas estructuradas es inválido."
            )
        points = metric.get("points", [])
        if not isinstance(points, list) or any(
            not isinstance(point, dict) for point in points
        ):
            raise ComparisonResultsInvalid(
                "Los puntos de una métrica estructurada son inválidos."
            )
    return metrics


def _mapping(value):
    return value if isinstance(value, dict) else {}


def _normalized_text(value):
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    text = WHITESPACE_RE.sub(" ", str(value).strip())
    return text or None


def _comparison_text(value):
    text = _normalized_text(value)
    return text.casefold() if text is not None else None


def _compiler_flags(value):
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    text = str(value).strip()
    return text or None


def _finite_number(value):
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    if number.is_integer():
        return int(number)
    return number


def _nonnegative_int(value):
    number = _finite_number(value)
    if not isinstance(number, int) or number < 0:
        return None
    return number


def _positive_int(value):
    number = _nonnegative_int(value)
    return number if number is not None and number > 0 else None


def _public_scalar(value):
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value if isinstance(value, (bool, int, float, str)) else str(value)


def _safe_basename(value):
    text = _normalized_text(value)
    if text is None or "\x00" in text:
        return None
    name = PurePosixPath(text.replace("\\", "/")).name
    if name in {"", ".", ".."}:
        return None
    return name


def _protocol_scalar(source_key, value):
    if source_key in {"points", "samples_per_point", "warmup_rounds"}:
        return _nonnegative_int(value)
    if source_key == "single_event_fallback":
        return value if isinstance(value, bool) else None
    return _normalized_text(value)


def _protocol_comparable(source_key, value):
    if source_key in {"schema_version", "perf_scope"}:
        return _comparison_text(value)
    return value


def _normalize_execution_context(context):
    if not isinstance(context, dict):
        raise ComparisonResultsInvalid(
            "El contexto persistido de una ejecución es inválido."
        )

    execution_config = _mapping(context.get("execution_config"))
    measurement_config = _mapping(execution_config.get("measurement"))
    hardware_snapshot = _mapping(context.get("hardware_snapshot"))
    node = _mapping(hardware_snapshot.get("node"))
    measurement_observed = _mapping(hardware_snapshot.get("measurement"))

    cpu = {
        "vendor": _normalized_text(node.get("cpu_vendor")),
        "model": _normalized_text(node.get("cpu_model")),
        "architecture": _normalized_text(node.get("architecture")),
        "logicalCpus": _positive_int(node.get("logical_cpus")),
    }
    backend = {
        "name": _normalized_text(measurement_observed.get("backend")),
        "version": _normalized_text(
            measurement_observed.get("perf_version")
        ),
        "requestedScope": _normalized_text(
            measurement_observed.get("requested_perf_scope")
        ),
    }
    protocol = {
        target_key: _protocol_scalar(
            source_key,
            measurement_config.get(source_key),
        )
        for source_key, target_key in REQUIRED_PROTOCOL_FIELDS
    }
    samples = _positive_int(context.get("samples"))
    flags = _compiler_flags(execution_config.get("compiler_flags"))
    source_filename = _safe_basename(
        execution_config.get("original_filename")
    )

    codename = _normalized_text(context.get("codename"))
    public = {
        "publicId": _public_scalar(context.get("public_id")),
        "codename": codename,
        "submissionId": _public_scalar(context.get("submission_id")),
        "submissionTitle": _normalized_text(
            context.get("submission_title")
        ),
        "sourceFilename": source_filename,
        "state": _normalized_text(context.get("execution_state")),
        "benchmark": _normalized_text(context.get("benchmark")),
        "profile": _normalized_text(context.get("execution_profile")),
        "samples": samples,
        "compilerFlags": flags,
        "hardwareObserved": {
            "cpu": dict(cpu),
            "measurementBackend": dict(backend),
        },
        "protocol": dict(protocol),
    }

    return {
        "codename": codename,
        "benchmark": public["benchmark"],
        "profile": public["profile"],
        "samples": samples,
        "compilerFlags": flags,
        "cpu": cpu,
        "backend": backend,
        "protocol": protocol,
        "public": public,
    }


def _issue(code, dimension, message, **extra):
    payload = {
        "code": code,
        "dimension": dimension,
        "message": message,
    }
    for key, value in extra.items():
        if value is not None:
            payload[key] = value
    return payload


def _add_issue(collection, code, dimension, message, **extra):
    candidate = _issue(code, dimension, message, **extra)
    identity = (
        candidate["code"],
        candidate["dimension"],
        candidate.get("metric"),
        candidate.get("codename"),
    )
    for current in collection:
        if (
            current["code"],
            current["dimension"],
            current.get("metric"),
            current.get("codename"),
        ) == identity:
            return
    collection.append(candidate)


def _dimension_status(values, *, missing=False, mismatch=False):
    if missing:
        status = "UNVERIFIED"
    elif mismatch:
        status = "MISMATCH"
    else:
        status = "MATCH"
    return {
        "status": status,
        "verified": not missing,
    }


def _benchmark_gate(contexts, blockers):
    values = [_comparison_text(item["benchmark"]) for item in contexts]
    missing = any(value is None for value in values)
    mismatch = not missing and len(set(values)) > 1
    if missing:
        _add_issue(
            blockers,
            "BENCHMARK_UNVERIFIED",
            "benchmark",
            "No fue posible verificar el benchmark de todas las ejecuciones.",
        )
    elif mismatch:
        _add_issue(
            blockers,
            "BENCHMARK_MISMATCH",
            "benchmark",
            "Las ejecuciones usan benchmarks diferentes.",
        )
    return _dimension_status(values, missing=missing, mismatch=mismatch)


def _hardware_gate(contexts, blockers):
    comparable = []
    missing = False
    for item in contexts:
        cpu = item["cpu"]
        values = (
            _comparison_text(cpu["vendor"]),
            _comparison_text(cpu["model"]),
            _comparison_text(cpu["architecture"]),
            cpu["logicalCpus"],
        )
        comparable.append(values)
        missing = missing or any(value is None for value in values)
    mismatch = not missing and len(set(comparable)) > 1
    if missing:
        _add_issue(
            blockers,
            "HARDWARE_UNVERIFIED",
            "hardware",
            "No fue posible verificar el hardware observado de todas las ejecuciones.",
        )
    elif mismatch:
        _add_issue(
            blockers,
            "HARDWARE_MISMATCH",
            "hardware",
            "Las ejecuciones fueron medidas en hardware observado diferente.",
        )
    return _dimension_status(comparable, missing=missing, mismatch=mismatch)


def _measurement_backend_gate(contexts, blockers, warnings):
    names = [_comparison_text(item["backend"]["name"]) for item in contexts]
    missing = any(value is None for value in names)
    mismatch = not missing and len(set(names)) > 1
    if missing:
        _add_issue(
            blockers,
            "MEASUREMENT_BACKEND_UNVERIFIED",
            "measurementBackend",
            "No fue posible verificar el backend de medición.",
        )
    elif mismatch:
        _add_issue(
            blockers,
            "MEASUREMENT_BACKEND_MISMATCH",
            "measurementBackend",
            "Las ejecuciones usan backends de medición diferentes.",
        )

    versions = [
        _comparison_text(item["backend"]["version"])
        for item in contexts
    ]
    if any(value is None for value in versions):
        version_status = "UNVERIFIED"
        _add_issue(
            warnings,
            "MEASUREMENT_BACKEND_VERSION_UNVERIFIED",
            "measurementBackend",
            "No fue posible verificar la versión del backend en todas las ejecuciones.",
        )
    elif len(set(versions)) > 1:
        version_status = "DIFFERS"
        _add_issue(
            warnings,
            "MEASUREMENT_BACKEND_VERSION_DIFFERS",
            "measurementBackend",
            "Las versiones observadas del backend de medición son diferentes.",
        )
    else:
        version_status = "MATCH"

    dimension = _dimension_status(names, missing=missing, mismatch=mismatch)
    dimension["versionStatus"] = version_status
    return dimension


def _profile_gate(contexts, blockers):
    values = [_comparison_text(item["profile"]) for item in contexts]
    missing = any(value is None for value in values)
    mismatch = not missing and len(set(values)) > 1
    if missing:
        _add_issue(
            blockers,
            "PROFILE_UNVERIFIED",
            "profile",
            "No fue posible verificar el perfil de ejecución.",
        )
    elif mismatch:
        _add_issue(
            blockers,
            "PROFILE_MISMATCH",
            "profile",
            "Las ejecuciones usan perfiles diferentes.",
        )
    return _dimension_status(values, missing=missing, mismatch=mismatch)


def _protocol_gate(contexts, blockers):
    comparable = []
    missing = False
    internally_inconsistent = False
    for item in contexts:
        protocol = item["protocol"]
        values = []
        for source_key, target_key in REQUIRED_PROTOCOL_FIELDS:
            value = protocol[target_key]
            values.append(_protocol_comparable(source_key, value))
        values.append(item["samples"])
        requested_scope = _comparison_text(
            item["backend"]["requestedScope"]
        )
        values.append(requested_scope)
        comparable.append(tuple(values))
        missing = missing or any(value is None for value in values)
        perf_scope = _comparison_text(protocol["perfScope"])
        if (
            perf_scope is not None
            and requested_scope is not None
            and perf_scope != requested_scope
        ):
            internally_inconsistent = True

    mismatch = (
        not missing
        and (len(set(comparable)) > 1 or internally_inconsistent)
    )
    if missing:
        _add_issue(
            blockers,
            "PROTOCOL_UNVERIFIED",
            "protocol",
            "No fue posible verificar el protocolo completo de medición.",
        )
    elif mismatch:
        _add_issue(
            blockers,
            "PROTOCOL_MISMATCH",
            "protocol",
            "Las ejecuciones usan protocolos de medición diferentes.",
        )
    return _dimension_status(comparable, missing=missing, mismatch=mismatch)


def _compiler_flags_gate(contexts, blockers):
    values = [item["compilerFlags"] for item in contexts]
    missing = any(value is None for value in values)
    mismatch = not missing and len(set(values)) > 1
    if missing:
        _add_issue(
            blockers,
            "COMPILER_FLAGS_UNVERIFIED",
            "compilerFlags",
            "No fue posible verificar los compiler flags.",
        )
    elif mismatch:
        _add_issue(
            blockers,
            "COMPILER_FLAGS_MISMATCH",
            "compilerFlags",
            "Las ejecuciones usan compiler flags diferentes.",
        )
    return _dimension_status(values, missing=missing, mismatch=mismatch)


def _provenance_gate(metric_maps, blockers):
    ambiguous = False
    for metrics in metric_maps:
        sources = set()
        for metric in metrics.values():
            for point in metric.get("points", []):
                source = _safe_basename(point.get("source"))
                if source:
                    sources.add(source)
        if len(sources) > 1:
            ambiguous = True
            break
    if ambiguous:
        _add_issue(
            blockers,
            "AMBIGUOUS_RESULT_PROVENANCE",
            "sourceProvenance",
            "Una ejecución contiene resultados asociados a múltiples fuentes.",
        )
    return {
        "status": "AMBIGUOUS" if ambiguous else "VERIFIED",
        "verified": not ambiguous,
    }


def _numeric_metric_points(metric):
    if not isinstance(metric, dict):
        return {}
    result = {}
    for point in metric.get("points", []):
        input_size = _finite_number(point.get("input_size"))
        median = _finite_number(point.get("median"))
        if input_size is None or median is None:
            continue
        result.setdefault(input_size, point)
    return result


def _input_size_gate(
    contexts,
    measured_input_sizes,
    blockers,
    warnings,
):
    missing_duration = any(not values for values in measured_input_sizes)
    if missing_duration:
        _add_issue(
            blockers,
            "DURATION_UNAVAILABLE",
            "inputSizes",
            "DurationTime no está disponible con puntos numéricos en todas las ejecuciones.",
        )
        common = set()
    else:
        common = set.intersection(*measured_input_sizes)
        if not common:
            _add_issue(
                blockers,
                "NO_COMMON_INPUT_SIZE",
                "inputSizes",
                "Las ejecuciones no comparten ningún InputSize medido.",
            )

    common_sorted = sorted(common)
    partial = bool(common) and any(
        values != common for values in measured_input_sizes
    )
    if partial:
        _add_issue(
            warnings,
            "PARTIAL_INPUT_OVERLAP",
            "inputSizes",
            "Las ejecuciones sólo comparten una parte de los InputSize medidos.",
        )
    if len(common_sorted) == 1:
        _add_issue(
            warnings,
            "SINGLE_COMMON_INPUT_SIZE",
            "inputSizes",
            "La comparación dispone de un único InputSize común.",
        )

    if missing_duration:
        dimension_status = "UNAVAILABLE"
    elif not common:
        dimension_status = "NO_OVERLAP"
    elif partial:
        dimension_status = "PARTIAL"
    else:
        dimension_status = "MATCH"

    coverage = []
    for item, values in zip(contexts, measured_input_sizes):
        coverage.append(
            {
                "publicId": item["public"]["publicId"],
                "codename": item["public"]["codename"],
                "sourceFilename": item["public"]["sourceFilename"],
                "inputSizes": sorted(values),
            }
        )

    return {
        "dimension": {
            "status": dimension_status,
            "verified": not missing_duration,
        },
        "commonInputSizes": common_sorted,
        "inputCoverage": coverage,
    }


def _metric_order(metric_names):
    target_rank = {name: index for index, name in enumerate(TARGET_METRICS)}
    return sorted(
        metric_names,
        key=lambda name: (
            0 if name in target_rank else 1,
            target_rank.get(name, 0),
            name.casefold(),
            name,
        ),
    )


def _excluded(metric, reason_code, message):
    return {
        "metric": metric,
        "reasonCode": reason_code,
        "message": message,
    }


def _target_unavailable(metric, warnings, reason_code, message):
    if metric != "DurationTime":
        _add_issue(
            warnings,
            "TARGET_METRIC_UNAVAILABLE",
            "metrics",
            "La métrica objetivo no es comparable en todas las ejecuciones.",
            metric=metric,
        )
    return _excluded(metric, reason_code, message)


def _build_metrics(
    contexts,
    metric_maps,
    common_input_sizes,
    blockers,
    warnings,
):
    common_names = set(metric_maps[0])
    for metrics in metric_maps[1:]:
        common_names.intersection_update(metrics)

    candidates = set(common_names)
    candidates.update(TARGET_METRICS)
    output = {}
    common_metrics = []
    excluded_metrics = []
    global_sizes = set(common_input_sizes)

    if not global_sizes:
        duration_unavailable = any(
            issue.get("code") == "DURATION_UNAVAILABLE"
            for issue in blockers
        )
        reason_code = (
            "DURATION_UNAVAILABLE"
            if duration_unavailable
            else "NO_COMMON_INPUT_SIZE"
        )
        message = (
            "No fue posible construir métricas comparables sin DurationTime."
            if duration_unavailable
            else "No fue posible construir métricas sin un InputSize común."
        )
        return {
            "dimension": {
                "status": "UNAVAILABLE",
                "verified": False,
            },
            "commonMetrics": [],
            "excludedMetrics": [
                _excluded(metric, reason_code, message)
                for metric in TARGET_METRICS
            ],
            "metrics": {},
        }

    for metric_name in _metric_order(candidates):
        entries = [metrics.get(metric_name) for metrics in metric_maps]
        if any(entry is None for entry in entries):
            if metric_name in TARGET_METRICS:
                excluded_metrics.append(
                    _target_unavailable(
                        metric_name,
                        warnings,
                        "TARGET_METRIC_UNAVAILABLE",
                        "La métrica objetivo no existe en todas las ejecuciones.",
                    )
                )
            continue

        units = [_normalized_text(entry.get("unit")) for entry in entries]
        unit_keys = [_comparison_text(unit) for unit in units]
        if any(unit is None for unit in unit_keys) or len(set(unit_keys)) > 1:
            if metric_name in TARGET_METRICS:
                _add_issue(
                    warnings,
                    "METRIC_UNIT_MISMATCH",
                    "metrics",
                    "La unidad de la métrica objetivo no coincide.",
                    metric=metric_name,
                )
                excluded_metrics.append(
                    _target_unavailable(
                        metric_name,
                        warnings,
                        "METRIC_UNIT_MISMATCH",
                        "La métrica fue excluida porque sus unidades no coinciden.",
                    )
                )
            continue

        point_maps = [_numeric_metric_points(entry) for entry in entries]
        metric_common = set.intersection(
            *(set(point_map) for point_map in point_maps)
        )
        metric_common.intersection_update(global_sizes)
        if not metric_common:
            if metric_name in TARGET_METRICS:
                excluded_metrics.append(
                    _target_unavailable(
                        metric_name,
                        warnings,
                        "TARGET_METRIC_UNAVAILABLE",
                        "La métrica objetivo no tiene puntos comunes válidos.",
                    )
                )
            continue

        metric_sizes = sorted(metric_common)
        if metric_common != global_sizes:
            _add_issue(
                warnings,
                "METRIC_PARTIAL_COVERAGE",
                "metrics",
                "La métrica sólo cubre parte de los InputSize comunes.",
                metric=metric_name,
            )

        series = []
        for item, point_map in zip(contexts, point_maps):
            series.append(
                {
                    "publicId": item["public"]["publicId"],
                    "codename": item["public"]["codename"],
                    "sourceFilename": item["public"]["sourceFilename"],
                    "points": [
                        _public_point(point_map[input_size], input_size)
                        for input_size in metric_sizes
                    ],
                }
            )

        output[metric_name] = {
            "unit": units[0],
            "commonInputSizes": metric_sizes,
            "series": series,
        }
        common_metrics.append(metric_name)

    if (
        global_sizes
        and "DurationTime" not in common_metrics
        and not any(
            issue.get("code") == "DURATION_UNAVAILABLE"
            for issue in blockers
        )
    ):
        _add_issue(
            blockers,
            "DURATION_UNAVAILABLE",
            "metrics",
            "DurationTime no está disponible como métrica comparable.",
        )

    return {
        "dimension": {
            "status": "MATCH" if not excluded_metrics else "LIMITED",
            "verified": "DurationTime" in common_metrics,
        },
        "commonMetrics": common_metrics,
        "excludedMetrics": excluded_metrics,
        "metrics": output,
    }


def _public_point(point, input_size):
    return {
        "inputSize": input_size,
        "median": _finite_number(point.get("median")),
        "mean": _finite_number(point.get("mean")),
        "stddev": _finite_number(point.get("stddev")),
        "q1": _finite_number(point.get("q1")),
        "q3": _finite_number(point.get("q3")),
        "iqr": _finite_number(point.get("iqr")),
        "samplesTotal": _nonnegative_int(point.get("samples_total")),
        "samplesValid": _nonnegative_int(point.get("samples_valid")),
        "iqrOutliersDetected": _nonnegative_int(
            point.get("iqr_outliers_detected")
        ),
    }


def _sorted_issues(issues):
    return sorted(
        issues,
        key=lambda item: (
            DIMENSION_ORDER.get(item.get("dimension"), 99),
            item.get("code", ""),
            item.get("metric", ""),
            item.get("codename", ""),
        ),
    )
