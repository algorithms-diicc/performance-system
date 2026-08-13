#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RESULTS = ROOT / "Server/webapp/services/results_service.py"
CONSTANTS = ROOT / "Client/my-app/src/common/Constants.js"

results_text = RESULTS.read_text(encoding="utf-8")
constants_text = CONSTANTS.read_text(encoding="utf-8")

assert '"unsupported": "measurement_event_unavailable"' in results_text
assert '"unsupported": "hardware_event_unsupported"' not in results_text

assert "dominio físico CPU Package" in constants_text
assert "no atribuye de forma exclusiva ese consumo al proceso" in constants_text
assert "EnergyCores" in constants_text
assert "EnergyRAM" in constants_text
assert "nunca se sustituye por cero" in constants_text

print("CORE-06C-2B semantic contract: PASS")
