import json
import math
import os
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from Server.webapp.services.interpretation_service import build_results_analysis
from Server.webapp.services.pedagogy_service import build_pedagogical_interpretation


SCHEMA_VERSION = "1.3"
IQR_MULTIPLIER = 1.5
MIN_N_AFTER_IQR = 5
AVAILABILITY_FILENAME = "MetricAvailability.json"

# CORE-06B-2: dependencias de métricas derivadas.
DERIVED_METRIC_DEPENDENCIES = {
    "IPC": ("Instructions", "CpuCycles"),
    "CacheMissRate": ("CacheMisses", "CacheReferences"),
    "BranchMissRate": ("BranchMisses", "Branches"),
    "BranchMissesPerMI": ("BranchMisses", "Instructions"),
    # CORE-06B-4: no inferir CacheMissesPerMI desde runs distintos.
}

# Columnas de contexto/medición que no se exponen como métricas del dashboard.
META_COLUMNS = {
    "Increment",
    "InputSize",
    "StartTime",
    "EndTime",
    "source",
}

UNSUPPORTED_MARKERS = {
    "<not-supported>",
    "<not supported>",
}

NOT_COUNTED_MARKERS = {
    "<not-counted>",
    "<not counted>",
}
PERMISSION_DENIED_MARKERS = {
    "<permission-denied>",
    "<permission denied>",
}

# Unidad de almacenamiento en el JSON. Las tasas se mantienen como ratio
# (ej. 0.0354) y React decidirá si las presenta como porcentaje (3.54 %).
METRIC_UNITS = {
    "Instructions": "count",
    "CpuCycles": "count",
    "TaskClock": "ms",
    "CpuClock": "ms",
    "Branches": "count",
    "BranchMisses": "count",
    "LLCLoads": "count",
    "LLCLoadMisses": "count",
    "LLCStores": "count",
    "LLCStoreMisses": "count",
    "L1DcacheLoads": "count",
    "L1DcacheLoadMisses": "count",
    "L1DcacheStores": "count",
    "CacheReferences": "count",
    "CacheMisses": "count",
    "PageFaults": "count",
    "MajorFaults": "count",
    "EnergyPkg": "J",
    "EnergyCores": "J",
    "EnergyRAM": "J",
    "DurationTime": "ms",
    "IPC": "ratio",
    "CacheMissRate": "ratio",
    "BranchMissRate": "ratio",
    "BranchMissesPerMI": "per_million_instructions",
    "CacheMissesPerMI": "per_million_instructions",
}


class ResultsNotFoundError(FileNotFoundError):
    """No existen resultados procesados para el codename solicitado."""


class ResultsInvalidError(ValueError):
    """Los resultados existen, pero no cumplen el contrato mínimo esperado."""


def build_execution_results(
    static_dir,
    codename,
    hardware_snapshot=None,
):
    """
    Construye el contrato JSON v1.3 para una ejecución.

    Fuente de verdad:
      Server/webapp/static/<codename>/CombinedResults.csv

    Importante:
    - NO recalcula IPC, CacheMissRate, BranchMissRate ni métricas normalizadas.
      Esas columnas ya fueron generadas por dataProcessing.py y se consumen
      directamente desde CombinedResults.csv.
    - Los agregados se calculan sobre todas las muestras numéricas.
    - El criterio IQR 1.5x se conserva únicamente como diagnóstico descriptivo;
      no elimina observaciones ni modifica mediana, media o desviación estándar.
    """
    results_dir = os.path.join(static_dir, codename)
    combined_csv_path = os.path.join(results_dir, "CombinedResults.csv")
    status_path = os.path.join(static_dir, f"{codename}_status.json")

    if not os.path.isfile(combined_csv_path):
        raise ResultsNotFoundError(
            f"No se encontró CombinedResults.csv para la ejecución {codename}."
        )

    try:
        # dtype=str conserva <not-supported>/<not-counted> para clasificar
        # correctamente la disponibilidad de cada métrica.
        raw_df = pd.read_csv(
            combined_csv_path,
            dtype=str,
            keep_default_na=False,
        )
    except Exception as exc:
        raise ResultsInvalidError(
            f"No fue posible leer CombinedResults.csv: {exc}"
        ) from exc

    if raw_df.empty:
        raise ResultsInvalidError("CombinedResults.csv está vacío.")

    if "InputSize" not in raw_df.columns:
        raise ResultsInvalidError(
            "CombinedResults.csv no contiene la columna obligatoria InputSize."
        )

    status_data = _read_optional_status(status_path)

    availability_metrics, availability_source = (
        _load_availability_provenance(
            static_dir=static_dir,
            codename=codename,
            results_dir=results_dir,
        )
    )

    # CORE-06B-2: compatibilidad con sidecars antiguos que todavía no
    # contienen métricas derivadas.
    availability_metrics = _extend_legacy_derived_availability(
        raw_df,
        availability_metrics,
    )

    metric_names = [
        column
        for column in raw_df.columns
        if column not in META_COLUMNS
    ]

    metrics = {
        metric_name: _build_metric_payload(
            raw_df,
            metric_name,
            availability_metrics.get(metric_name),
            availability_source,
            hardware_context=_metric_hardware_context(
                metric_name,
                hardware_snapshot,
            ),
        )
        for metric_name in metric_names
    }

    source_names = _get_sources(raw_df, status_data)
    analysis = build_results_analysis(metrics)
    pedagogy = build_pedagogical_interpretation(analysis, metrics)

    return {
        "schema_version": SCHEMA_VERSION,
        "execution": _attach_measurement_context(
            _build_execution_metadata(
                codename=codename,
                status_data=status_data,
                source_names=source_names,
                results_path=combined_csv_path,
            ),
            hardware_snapshot,
        ),
        "processing": {
            "aggregation": "median",
            "additional_aggregations": ["mean"],
            "dispersion": "sample_stddev",
            "dispersion_scope": "raw_numeric_samples",
            "quartiles": ["q1", "q3"],
            "sample_basis": "raw_numeric_samples",
            "outlier_filter": {
                "method": "iqr",
                "multiplier": IQR_MULTIPLIER,
                "min_samples": MIN_N_AFTER_IQR,
                "mode": "diagnostic_only",
                "removes_samples": False,
                "affects_aggregates": False,
            },
            "rates_representation": "ratio",
            "availability_provenance": availability_source,
        },
        "metrics": metrics,
        "analysis": analysis,
        "pedagogy": pedagogy,
    }


def _build_measurement_context(hardware_snapshot):
    """
    CORE-06C-5B.

    Proyección sanitizada del entorno observado para presentar resultados.
    Conserva provenance útil sin exponer el hardware_snapshot completo ni
    convertir vendor/modelo en reglas de disponibilidad.
    """
    if not isinstance(hardware_snapshot, dict):
        return None

    node = hardware_snapshot.get("node")
    measurement = hardware_snapshot.get("measurement")

    cpu = {}
    if isinstance(node, dict):
        for source_key, target_key in (
            ("cpu_vendor", "vendor"),
            ("cpu_model", "model"),
            ("architecture", "architecture"),
            ("logical_cpus", "logical_cpus"),
        ):
            value = node.get(source_key)
            if value is not None and value != "":
                cpu[target_key] = value

    backend = {}
    if isinstance(measurement, dict):
        for source_key, target_key in (
            ("backend", "name"),
            ("perf_version", "version"),
            ("requested_perf_scope", "requested_scope"),
        ):
            value = measurement.get(source_key)
            if value is not None and value != "":
                backend[target_key] = value

    context = {
        "source": "execution.hardware_snapshot",
    }

    if cpu:
        context["cpu"] = cpu

    if backend:
        context["backend"] = backend

    if len(context) == 1:
        return None

    return context


def _attach_measurement_context(
    execution_metadata,
    hardware_snapshot,
):
    metadata = dict(execution_metadata or {})
    measurement_context = _build_measurement_context(
        hardware_snapshot
    )

    if measurement_context is not None:
        metadata["measurement_context"] = measurement_context

    return metadata

def _metric_hardware_context(
    metric_name,
    hardware_snapshot,
):
    """
    CORE-06C-4.

    Expone únicamente provenance observable para métricas energéticas.
    No convierte ausencia del backend en una afirmación sobre capacidad
    física del hardware.
    """
    if metric_name not in {
        "EnergyPkg",
        "EnergyCores",
        "EnergyRAM",
    }:
        return None

    if not isinstance(hardware_snapshot, dict):
        return None

    energy = hardware_snapshot.get("energy")
    if not isinstance(energy, dict):
        return None

    metric_context = energy.get(metric_name)
    if not isinstance(metric_context, dict):
        return None

    context = {
        "source": "execution.hardware_snapshot",
    }

    for key in (
        "event",
        "event_exposed",
        "probe_state",
        "measurement_available",
    ):
        if key in metric_context:
            context[key] = metric_context[key]

    if len(context) == 1:
        return None

    return context

def _build_metric_payload(
    raw_df,
    metric_name,
    provenance=None,
    provenance_source="combined_results",
    hardware_context=None,
):
    unit = METRIC_UNITS.get(metric_name, "unknown")

    points = []
    total_rows = len(raw_df)
    numeric_total = 0
    unsupported_total = 0
    not_counted_total = 0
    permission_denied_total = 0
    missing_total = 0
    groups_total = 0
    groups_with_data = 0

    group_columns = ["InputSize"]
    if "source" in raw_df.columns:
        group_columns = ["source", "InputSize"]

    # Compatibilidad con versiones antiguas de pandas:
    # DataFrame.groupby(..., dropna=False) no existe en algunas versiones.
    #
    # En este servicio el CSV se lee con dtype=str y keep_default_na=False,
    # por lo que las claves vacías permanecen como cadenas "" en vez de NaN.
    # Por ello podemos omitir dropna=False sin cambiar el comportamiento
    # esperado del agrupamiento.
    grouped = raw_df.groupby(
        group_columns,
        sort=True,
    )

    for group_key, group_df in grouped:
        groups_total += 1

        if isinstance(group_key, tuple):
            source, input_size_raw = group_key
        else:
            source = ""
            input_size_raw = group_key

        availability = _classify_raw_values(group_df[metric_name])
        numeric_total += availability["numeric"]
        unsupported_total += availability["unsupported"]
        not_counted_total += availability["not_counted"]
        permission_denied_total += availability["permission_denied"]
        missing_total += availability["missing"]

        numeric_series = pd.to_numeric(
            group_df[metric_name],
            errors="coerce",
        ).dropna()

        if numeric_series.empty:
            continue

        groups_with_data += 1
        stats = _iqr_statistics(numeric_series)

        points.append(
            {
                "source": str(source) if source else None,
                "input_size": _to_number(input_size_raw),
                "mean": _finite_or_none(stats["mean"]),
                "median": _finite_or_none(stats["median"]),
                "stddev": _finite_or_none(stats["stddev"]),
                "q1": _finite_or_none(stats["q1"]),
                "q3": _finite_or_none(stats["q3"]),
                "iqr": _finite_or_none(stats["iqr"]),
                "samples_total": int(stats["samples_total"]),
                "samples_valid": int(stats["samples_valid"]),
                "outliers_removed": int(stats["outliers_removed"]),
                "iqr_applied": bool(stats["iqr_applied"]),
                "iqr_diagnostic_applied": bool(
                    stats["iqr_diagnostic_applied"]
                ),
                "iqr_inliers": int(stats["iqr_inliers"]),
                "iqr_outliers_detected": int(
                    stats["iqr_outliers_detected"]
                ),
            }
        )

    points.sort(
        key=lambda point: (
            point.get("source") or "",
            _sort_number(point.get("input_size")),
        )
    )

    # CombinedResults.csv puede haber perdido el marcador <not-counted>
    # al convertirlo a NaN durante dataProcessing.py. Cuando existe
    # procedencia de disponibilidad, se utilizan esos conteos originales
    # para conservar el motivo real de indisponibilidad.
    if provenance:
        numeric_total = int(provenance.get("numeric", numeric_total))
        unsupported_total = int(
            provenance.get("unsupported", unsupported_total)
        )
        not_counted_total = int(
            provenance.get("not_counted", not_counted_total)
        )
        permission_denied_total = int(
            provenance.get("permission_denied", permission_denied_total)
        )
        missing_total = int(provenance.get("missing", missing_total))
        total_rows = int(provenance.get("rows_total", total_rows))

    status = _derive_metric_status(
        numeric_total=numeric_total,
        unsupported_total=unsupported_total,
        not_counted_total=not_counted_total,
        permission_denied_total=permission_denied_total,
        missing_total=missing_total,
        groups_total=groups_total,
        groups_with_data=groups_with_data,
    )

    payload = {
        "status": status,
        "reason": _metric_status_reason(status),
        "unit": unit,
        "availability": {
            "rows_total": int(total_rows),
            "numeric": int(numeric_total),
            "unsupported": int(unsupported_total),
            "not_counted": int(not_counted_total),
            "permission_denied": int(permission_denied_total),
            "missing": int(missing_total),
            "groups_total": int(groups_total),
            "groups_with_data": int(groups_with_data),
            "provenance": (
                provenance_source
                if provenance
                else "combined_results"
            ),
        },
        "points": points,
    }

    if hardware_context is not None:
        payload["hardware_context"] = hardware_context

    return payload


def _iqr_statistics(series):
    """
    CORE-06D-4 — contrato estadístico.

    Los agregados principales se calculan sobre TODAS las muestras numéricas.
    La mediana es el estimador principal del contrato. Media y desviación
    estándar muestral se conservan como información complementaria.

    El criterio 1.5xIQR se usa sólo como diagnóstico descriptivo:
    identifica observaciones fuera de [Q1-1.5*IQR, Q3+1.5*IQR], pero no las
    elimina ni modifica los agregados.
    """
    s = pd.to_numeric(series, errors="coerce").dropna()
    samples_total = int(s.size)

    if samples_total == 0:
        return {
            "mean": np.nan,
            "median": np.nan,
            "stddev": np.nan,
            "q1": np.nan,
            "q3": np.nan,
            "iqr": np.nan,
            "samples_total": 0,
            "samples_valid": 0,
            "outliers_removed": 0,
            "iqr_applied": False,
            "iqr_diagnostic_applied": False,
            "iqr_inliers": 0,
            "iqr_outliers_detected": 0,
        }

    q1 = s.quantile(0.25)
    q3 = s.quantile(0.75)
    iqr = q3 - q1
    diagnostic_applied = samples_total >= MIN_N_AFTER_IQR

    if diagnostic_applied:
        lower = q1 - IQR_MULTIPLIER * iqr
        upper = q3 + IQR_MULTIPLIER * iqr
        inlier_mask = (s >= lower) & (s <= upper)
        iqr_inliers = int(inlier_mask.sum())
        iqr_outliers_detected = samples_total - iqr_inliers
    else:
        iqr_inliers = samples_total
        iqr_outliers_detected = 0

    return {
        "mean": s.mean(),
        "median": s.median(),
        "stddev": s.std(ddof=1),
        "q1": q1,
        "q3": q3,
        "iqr": iqr,
        "samples_total": samples_total,
        "samples_valid": samples_total,
        "outliers_removed": 0,
        "iqr_applied": False,
        "iqr_diagnostic_applied": diagnostic_applied,
        "iqr_inliers": iqr_inliers,
        "iqr_outliers_detected": iqr_outliers_detected,
    }

def _classify_raw_values(series):
    result = {
        "numeric": 0,
        "unsupported": 0,
        "not_counted": 0,
        "permission_denied": 0,
        "missing": 0,
    }

    for value in series.tolist():
        value_text = str(value).strip()
        normalized = value_text.lower()

        if not value_text or normalized in {"nan", "none", "null"}:
            result["missing"] += 1
            continue
        if normalized in UNSUPPORTED_MARKERS:
            result["unsupported"] += 1
            continue
        if normalized in NOT_COUNTED_MARKERS:
            result["not_counted"] += 1
            continue
        if normalized in PERMISSION_DENIED_MARKERS:
            result["permission_denied"] += 1
            continue

        number = pd.to_numeric(value_text, errors="coerce")
        if pd.isna(number):
            result["missing"] += 1
        else:
            result["numeric"] += 1

    return result


def _extend_legacy_derived_availability(raw_df, metrics):
    """
    Completa conservadoramente sidecars anteriores a CORE-06B-2.

    No inventa causas para casos parciales ambiguos. Sólo propaga una causa
    cuando una dependencia completa está marcada como permission_denied,
    unsupported o not_counted.
    """
    result = dict(metrics or {})
    rows_total = int(len(raw_df))

    for metric_name, dependencies in DERIVED_METRIC_DEPENDENCIES.items():
        if metric_name in result or metric_name not in raw_df.columns:
            continue

        direct = _classify_raw_values(raw_df[metric_name])
        direct["rows_total"] = rows_total

        if direct["numeric"] > 0:
            result[metric_name] = direct
            continue

        dependency_counts = [
            result.get(name)
            for name in dependencies
            if isinstance(result.get(name), dict)
        ]

        if len(dependency_counts) != len(dependencies):
            result[metric_name] = direct
            continue

        def pure_state(counts, key):
            total = int(counts.get("rows_total", rows_total))
            return (
                total > 0
                and int(counts.get(key, 0)) == total
                and int(counts.get("numeric", 0)) == 0
                and int(counts.get("missing", 0)) == 0
            )

        if any(
            pure_state(counts, "permission_denied")
            for counts in dependency_counts
        ):
            direct.update(
                {
                    "unsupported": 0,
                    "not_counted": 0,
                    "permission_denied": rows_total,
                    "missing": 0,
                }
            )
        elif any(
            pure_state(counts, "unsupported")
            for counts in dependency_counts
        ):
            direct.update(
                {
                    "unsupported": rows_total,
                    "not_counted": 0,
                    "permission_denied": 0,
                    "missing": 0,
                }
            )
        elif any(
            pure_state(counts, "not_counted")
            for counts in dependency_counts
        ):
            direct.update(
                {
                    "unsupported": 0,
                    "not_counted": rows_total,
                    "missing": 0,
                }
            )

        result[metric_name] = direct

    return result


def _derive_metric_status(
    numeric_total,
    unsupported_total,
    not_counted_total,
    permission_denied_total,
    missing_total,
    groups_total,
    groups_with_data,
):
    if numeric_total == 0:
        if (
            permission_denied_total > 0
            and unsupported_total == 0
            and not_counted_total == 0
            and missing_total == 0
        ):
            return "permission_denied"
        if (
            unsupported_total > 0
            and permission_denied_total == 0
            and not_counted_total == 0
            and missing_total == 0
        ):
            return "unsupported"
        if (
            not_counted_total > 0
            and permission_denied_total == 0
            and unsupported_total == 0
            and missing_total == 0
        ):
            return "not_counted"
        return "no_data"

    has_missing_samples = (
        permission_denied_total > 0
        or unsupported_total > 0
        or not_counted_total > 0
        or missing_total > 0
    )
    has_missing_groups = groups_with_data < groups_total
    if has_missing_samples or has_missing_groups:
        return "partial"
    return "available"


def _metric_status_reason(status):
    reasons = {
        "available": None,
        "partial": "partial_availability",
        "permission_denied": "measurement_permission_denied",
        "unsupported": "hardware_event_unsupported",
        "not_counted": "counter_not_counted",
        "no_data": "no_numeric_samples",
    }
    return reasons.get(status, "unknown")


def _load_availability_provenance(
    static_dir,
    codename,
    results_dir,
):
    """
    Recupera la procedencia de disponibilidad de las métricas.

    Prioridad:
    1) MetricAvailability.json generado por dataProcessing.py (nuevas ejecuciones).
    2) CSV bruto <codename>Results*.csv (compatibilidad con ejecuciones antiguas
       de una sola fuente, como 9868247794LCS).
    3) CombinedResults.csv solamente.
    """
    sidecar_path = os.path.join(
        results_dir,
        AVAILABILITY_FILENAME,
    )

    sidecar = _read_availability_sidecar(sidecar_path)
    if sidecar:
        metrics = sidecar.get("metrics")
        if isinstance(metrics, dict):
            return metrics, "metric_availability_sidecar"

    raw_candidates = []
    try:
        for filename in os.listdir(static_dir):
            if (
                filename.startswith(codename + "Results")
                and filename.endswith(".csv")
            ):
                raw_candidates.append(
                    os.path.join(static_dir, filename)
                )
    except OSError:
        raw_candidates = []

    # Para ejecuciones antiguas sólo se infiere desde el CSV bruto cuando
    # existe un único resultado asociado al codename. Así evitamos mezclar
    # procedencia de varias implementaciones sin una correspondencia explícita.
    if len(raw_candidates) == 1:
        try:
            raw_source_df = pd.read_csv(
                raw_candidates[0],
                dtype=str,
                keep_default_na=False,
            )
            return (
                _collect_dataframe_availability(raw_source_df),
                "raw_csv_fallback",
            )
        except Exception:
            pass

    return {}, "combined_results"


def _read_availability_sidecar(path):
    if not os.path.isfile(path):
        return {}

    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _collect_dataframe_availability(df):
    metrics = {}

    for metric_name in df.columns:
        if metric_name in META_COLUMNS:
            continue

        counts = _classify_raw_values(df[metric_name])
        counts["rows_total"] = int(len(df))
        metrics[metric_name] = counts

    return metrics


def _build_execution_metadata(
    codename,
    status_data,
    source_names,
    results_path,
):
    raw_status = status_data.get("status") if status_data else None

    files = []
    for item in status_data.get("files", []) if status_data else []:
        files.append(
            {
                "codename": item.get("codename") or codename,
                "filename": item.get("original_filename"),
            }
        )

    if not files:
        files = [
            {
                "codename": codename,
                "filename": source_names[0] if len(source_names) == 1 else None,
            }
        ]

    # Este endpoint sólo responde si CombinedResults.csv ya existe; por eso el
    # estado semántico de resultados es ready aunque el status heredado haya
    # quedado desactualizado (ej. raw_status=IN QUEUE).
    return {
        "id": codename,
        "benchmark": status_data.get("task_type") if status_data else None,
        "input_size": _to_number(
            status_data.get("input_size") if status_data else None
        ),
        "samples": _to_number(
            status_data.get("samples") if status_data else None
        ),
        "status": "ready",
        "raw_status": raw_status,
        "files": files,
        "sources": source_names,
        "results_file": {
            "name": "CombinedResults.csv",
            "modified_at": _file_mtime_iso(results_path),
        },
    }


def _read_optional_status(status_path):
    if not os.path.isfile(status_path):
        return {}

    try:
        with open(status_path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        # El CSV sigue siendo suficiente para entregar resultados. El endpoint
        # degrada metadata en vez de perder toda la respuesta.
        return {}


def _get_sources(raw_df, status_data):
    sources = []

    if "source" in raw_df.columns:
        for value in raw_df["source"].tolist():
            text = str(value).strip()
            if text and text.lower() not in {"nan", "none", "null"}:
                if text not in sources:
                    sources.append(text)

    if not sources and status_data:
        for item in status_data.get("files", []):
            filename = item.get("original_filename")
            if filename and filename not in sources:
                sources.append(filename)

    return sources


def _to_number(value):
    if value is None:
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return value

    if not math.isfinite(number):
        return None

    if number.is_integer():
        return int(number)

    return number


def _finite_or_none(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    return number if math.isfinite(number) else None


def _sort_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    return float("inf")


def _file_mtime_iso(path):
    try:
        timestamp = os.path.getmtime(path)
    except OSError:
        return None

    return datetime.fromtimestamp(
        timestamp,
        tz=timezone.utc,
    ).isoformat()