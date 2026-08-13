#!/usr/bin/env python3
"""Contrato mínimo CORE-06B-4."""
from pathlib import Path
import sys
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from Server.webapp import dataProcessing as dp


def require(condition, message):
    if not condition:
        raise AssertionError(message)


raw = pd.DataFrame({
    "NormalizedInstructions": ["1000", "2000", "<not-supported>"],
    "NormalizedCacheMisses": ["10", "30", "<not-supported>"],
})

availability = dp._collect_derived_availability(raw)

require(
    availability["CacheMissesPerMI"]["numeric"] == 2,
    "Se esperaban 2 filas numéricas.",
)
require(
    availability["CacheMissesPerMI"]["unsupported"] == 1,
    "Se esperaba propagación unsupported.",
)

legacy = pd.DataFrame({
    "Instructions": ["1000"],
    "CacheMisses": ["10"],
})
legacy_availability = dp._collect_derived_availability(legacy)

require(
    legacy_availability["CacheMissesPerMI"]["missing"] == 1,
    "Raw legacy no debe reconstruir la razón inválida.",
)

print("CORE-06B-4 metric contract: PASS")
