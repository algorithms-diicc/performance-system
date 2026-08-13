#!/usr/bin/env python3
from pathlib import Path
import ast
import math
import os
import subprocess
import sys

import numpy as np
import pandas as pd

REL_RESULTS = Path("Server/webapp/services/results_service.py")
REL_CREATION = Path("Server/webapp/services/execution_creation_service.py")
REL_PROCESSING = Path("Server/webapp/dataProcessing.py")
REL_RENDER = Path("Client/my-app/src/screens/RenderImage.js")


def find_root():
    env = os.environ.get("PERF_SYSTEM_ROOT")
    candidates = []
    if env:
        candidates.append(Path(env).expanduser().resolve())
    candidates += [Path.cwd().resolve(), Path(__file__).resolve().parent]
    expanded = []
    for candidate in candidates:
        expanded.append(candidate)
        expanded.extend(candidate.parents)
    seen = set()
    for candidate in expanded:
        if candidate in seen:
            continue
        seen.add(candidate)
        if (candidate / REL_RESULTS).is_file():
            return candidate
    raise SystemExit("ERROR: no pude localizar la raíz del proyecto.")

ROOT = find_root()
FAILURES = []
PASSES = []

def check(condition, name, detail=""):
    if condition:
        PASSES.append(name)
        print("[PASS]", name)
    else:
        FAILURES.append((name, detail))
        print("[FAIL]", name, detail)

def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")

def function_region_js(text, function_name):
    marker = f"function {function_name}("
    start = text.find(marker)
    if start < 0:
        return ""
    next_function = text.find("\nfunction ", start + len(marker))
    end = len(text) if next_function < 0 else next_function
    return text[start:end]

def extract_python_function(path, function_name, namespace):
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source)
    node = next((item for item in tree.body if isinstance(item, ast.FunctionDef) and item.name == function_name), None)
    if node is None:
        raise RuntimeError(f"No existe {function_name}")
    segment = ast.get_source_segment(source, node)
    if not segment:
        lines = source.splitlines()
        segment = "\n".join(lines[node.lineno - 1:node.end_lineno])
    exec(compile(segment, str(path), "exec"), namespace)
    return namespace[function_name]

def main():
    results = read(REL_RESULTS)
    creation = read(REL_CREATION)
    processing = read(REL_PROCESSING)
    render = read(REL_RENDER)

    for rel in [REL_RESULTS, REL_CREATION, REL_PROCESSING]:
        proc = subprocess.run([sys.executable, "-m", "py_compile", str(ROOT / rel)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        check(proc.returncode == 0, f"py_compile {rel}", proc.stderr.strip())

    check('"aggregation": "median"' in results, "API declara mediana como agregación principal")
    check('"additional_aggregations": ["mean"]' in results, "API conserva media como agregación complementaria")
    check('"sample_basis": "raw_numeric_samples"' in results, "API declara base muestral cruda")
    check('"mode": "diagnostic_only"' in results and '"removes_samples": False' in results and '"affects_aggregates": False' in results, "IQR declarado como diagnóstico no destructivo")
    check(all(marker in results for marker in ['"q1":', '"q3":', '"iqr":', '"iqr_diagnostic_applied":', '"iqr_inliers":', '"iqr_outliers_detected":']), "API expone cuartiles y diagnóstico IQR")

    try:
        stats_fn = extract_python_function(ROOT / REL_RESULTS, "_iqr_statistics", {"pd": pd, "np": np, "MIN_N_AFTER_IQR": 5, "IQR_MULTIPLIER": 1.5})
        sample = pd.Series([1, 1, 1, 1, 1, 100], dtype=float)
        got = stats_fn(sample)
        check(math.isclose(float(got["mean"]), 17.5, rel_tol=0, abs_tol=1e-12), "Media se calcula sobre muestra cruda", str(got))
        check(math.isclose(float(got["median"]), 1.0, rel_tol=0, abs_tol=1e-12), "Mediana se calcula sobre muestra cruda", str(got))
        check(got["samples_total"] == 6 and got["samples_valid"] == 6 and got["outliers_removed"] == 0, "Ninguna muestra numérica es eliminada", str(got))
        check(got["iqr_applied"] is False and got["iqr_diagnostic_applied"] is True and got["iqr_inliers"] == 5 and got["iqr_outliers_detected"] == 1, "IQR detecta sin filtrar", str(got))
        check(math.isclose(float(got["q1"]), 1.0, abs_tol=1e-12) and math.isclose(float(got["q3"]), 1.0, abs_tol=1e-12) and math.isclose(float(got["iqr"]), 0.0, abs_tol=1e-12), "Q1/Q3/IQR coherentes", str(got))
        short = stats_fn(pd.Series([1, 1, 1, 100], dtype=float))
        check(short["iqr_diagnostic_applied"] is False and short["iqr_outliers_detected"] == 0 and short["samples_valid"] == 4, "Diagnóstico IQR exige mínimo de 5 muestras", str(short))
    except Exception as exc:
        check(False, "_iqr_statistics ejecutable", repr(exc))

    check("DEFAULT_MEASUREMENT_POINTS = 10" in creation, "Protocolo final usa 10 puntos de entrada")
    check(all(marker in creation for marker in ['10: "QUICK"', '30: "BALANCED"', '50: "EXHAUSTIVE"', "DEFAULT_WARMUP_ROUNDS = 1"]), "Perfiles 10/30/50 y warmup=1 preservados")
    check("USE_IQR_FILTER = False" in processing, "Gráficos legacy no aplican filtrado IQR")
    check('const [aggregation, setAggregation] =\n    useState("median");' in render, "Frontend inicia en mediana")
    check('const handleResetFilters = () => {\n    setAggregation("median");' in render, "Reset vuelve a mediana")
    count_region = function_region_js(render, "countActiveFilters")
    check('aggregation !== "median"' in count_region and 'aggregation !== "mean"' not in count_region, "Contador de filtros trata mediana como valor base", count_region[:500])
    check('setAggregation("mean")' in render and 'setAggregation("median")' in render, "Usuario conserva selector Media/Mediana")
    check("buildHardwareAvailabilityExplanation" in render and "buildMeasurementContextSummary" in render, "UI de contexto/availability 06C preservada")

    print()
    print("=" * 72)
    if FAILURES:
        print(f"CORE-06D-4: FAIL — {len(FAILURES)} comprobaciones fallaron; {len(PASSES)} pasaron.")
        for name, detail in FAILURES:
            print(" -", name, detail)
        return 1
    print(f"CORE-06D-4: PASS — {len(PASSES)} comprobaciones pasaron.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
