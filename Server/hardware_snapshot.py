import glob
import os
import platform
import re
import subprocess

try:
    from .source_contract import COMPILER_C, COMPILER_CPP
except ImportError:
    try:
        from Server.source_contract import COMPILER_C, COMPILER_CPP
    except ImportError:
        from source_contract import COMPILER_C, COMPILER_CPP

ENERGY_EVENTS = {
    "EnergyPkg": "power/energy-pkg/",
    "EnergyCores": "power/energy-cores/",
    "EnergyRAM": "power/energy-ram/",
}


def _read_text(path):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    except (OSError, UnicodeError):
        return None


def _cpu_identity():
    vendor = None
    model = None
    text = _read_text("/proc/cpuinfo") or ""

    for line in text.splitlines():
        if not vendor and line.startswith("vendor_id"):
            vendor = line.split(":", 1)[-1].strip() or None
        elif not model and line.startswith("model name"):
            model = line.split(":", 1)[-1].strip() or None
        if vendor and model:
            break

    return {
        "architecture": platform.machine() or None,
        "cpu_vendor": vendor,
        "cpu_model": model or platform.processor() or None,
        "logical_cpus": os.cpu_count(),
    }


def _perf_version(perf_bin):
    try:
        completed = subprocess.run(
            [perf_bin, "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5,
            check=False,
            shell=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    text = (completed.stdout or completed.stderr or "").strip()
    return text or None


def _perf_list(perf_bin):
    try:
        completed = subprocess.run(
            [perf_bin, "list"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=10,
            check=False,
            shell=False,
        )
    except (OSError, subprocess.SubprocessError):
        return ""

    return "\n".join(
        part for part in (completed.stdout, completed.stderr) if part
    )


def _probe_perf_event(perf_bin, event):
    env = os.environ.copy()
    env["LC_NUMERIC"] = "C"

    try:
        completed = subprocess.run(
            [
                perf_bin,
                "stat",
                "--no-big-num",
                "-x;",
                "-e",
                event,
                "/bin/true",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=10,
            env=env,
            check=False,
            shell=False,
        )
    except (OSError, subprocess.SubprocessError):
        return {
            "probe_state": "backend_error",
            "measurement_available": False,
        }

    output = "\n".join(
        part for part in (completed.stdout, completed.stderr) if part
    )
    normalized = output.lower()

    permission_signatures = (
        "access to performance monitoring and observability operations is limited",
        "no permission to enable",
        "permission denied",
        "operation not permitted",
    )
    if any(signature in normalized for signature in permission_signatures):
        return {
            "probe_state": "permission_denied",
            "measurement_available": False,
        }

    if "<not supported>" in normalized or "<not-supported>" in normalized:
        return {
            "probe_state": "not_supported",
            "measurement_available": False,
        }

    if "<not counted>" in normalized or "<not-counted>" in normalized:
        return {
            "probe_state": "not_counted",
            "measurement_available": False,
        }

    event_token = event.rstrip("/")
    for line in output.splitlines():
        if event_token not in line:
            continue
        first = line.split(";", 1)[0].strip()
        if re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", first):
            return {
                "probe_state": "numeric",
                "measurement_available": True,
            }

    if completed.returncode != 0:
        return {
            "probe_state": "backend_error",
            "measurement_available": False,
        }

    return {
        "probe_state": "no_numeric_sample",
        "measurement_available": False,
    }


def _powercap_domains():
    result = {}
    candidates = (
        glob.glob("/sys/class/powercap/*/name")
        + glob.glob("/sys/class/powercap/*/*/name")
    )

    for name_path in candidates:
        name = _read_text(name_path)
        if not name:
            continue

        directory = os.path.dirname(name_path)
        energy_path = os.path.join(directory, "energy_uj")

        current = result.setdefault(
            name,
            {
                "energy_uj_exposed": False,
                "energy_uj_readable": False,
            },
        )

        if os.path.exists(energy_path):
            current["energy_uj_exposed"] = True
            if os.access(energy_path, os.R_OK):
                current["energy_uj_readable"] = True

    return result


def _compiler_snapshot(compiler):
    if compiler not in (COMPILER_C, COMPILER_CPP):
        return None

    version = None
    try:
        completed = subprocess.run(
            [compiler, "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5,
            check=False,
            shell=False,
        )
        output = (completed.stdout or completed.stderr or "").strip()
        if output:
            version = output.splitlines()[0].strip() or None
    except (OSError, subprocess.SubprocessError):
        version = None

    return {
        "family": "GNU",
        "name": compiler,
        "version": version,
    }


def collect_hardware_snapshot(
    measurement=None,
    perf_bin=None,
    compiler=None,
):
    measurement = measurement if isinstance(measurement, dict) else {}
    perf_bin = perf_bin or os.getenv("PERF_BIN", "perf")

    perf_list = _perf_list(perf_bin)
    energy = {}

    for metric, event in ENERGY_EVENTS.items():
        event_exposed = event in perf_list
        if event_exposed:
            probe = _probe_perf_event(perf_bin, event)
        else:
            probe = {
                "probe_state": "event_not_exposed",
                "measurement_available": False,
            }

        energy[metric] = {
            "event": event,
            "event_exposed": bool(event_exposed),
            "probe_state": probe["probe_state"],
            "measurement_available": bool(
                probe["measurement_available"]
            ),
        }

    snapshot = {
        "schema_version": "1.0",
        "node": _cpu_identity(),
        "measurement": {
            "backend": "perf",
            "perf_version": _perf_version(perf_bin),
            "requested_perf_scope": measurement.get(
                "perf_scope",
                "unknown",
            ),
            "perf_event_paranoid": _read_text(
                "/proc/sys/kernel/perf_event_paranoid"
            ),
        },
        "powercap": {
            "domains": _powercap_domains(),
        },
        "energy": energy,
    }

    compiler_snapshot = _compiler_snapshot(compiler)
    if compiler_snapshot is not None:
        snapshot["toolchain"] = {
            "compiler": compiler_snapshot,
        }

    return snapshot
