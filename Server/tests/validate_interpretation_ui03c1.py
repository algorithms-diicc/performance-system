#!/usr/bin/env python3
import argparse
import json
import math
import sys
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


EPSILON = 1e-9


def get_json(url):
    try:
        with urlopen(url, timeout=10) as response:
            return response.getcode(), json.loads(
                response.read().decode("utf-8")
            )
    except HTTPError as exc:
        return exc.code, json.loads(
            exc.read().decode("utf-8")
        )
    except (URLError, ValueError) as exc:
        raise RuntimeError(str(exc))


def check(name, condition, detail=""):
    result = "PASS" if condition else "FAIL"
    print("{:<52} {}".format(name, result))
    if detail and not condition:
        print("  {}".format(detail))
    return bool(condition)


def close(a, b, tolerance=EPSILON):
    if a is None or b is None:
        return a is b
    return abs(float(a) - float(b)) <= tolerance * max(
        1.0,
        abs(float(a)),
        abs(float(b)),
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--codename",
        default="9868247794LCS",
    )
    parser.add_argument(
        "--api",
        default="http://localhost:5000",
    )
    args = parser.parse_args()

    url = "{}/api/executions/{}/results".format(
        args.api.rstrip("/"),
        args.codename,
    )

    status, payload = get_json(url)

    print("PERFORMANCE SYSTEM — UI-03C-1 VALIDATION")
    print("Execution:", args.codename)
    print("API:", url)
    print("")

    checks = []

    checks.append(check("HTTP 200", status == 200))
    checks.append(
        check(
            "schema_version = 1.2",
            payload.get("schema_version") == "1.2",
            "Recibido: {!r}".format(payload.get("schema_version")),
        )
    )

    analysis = payload.get("analysis", {})
    metrics = payload.get("metrics", {})

    checks.append(
        check(
            "analysis.version = 1.0",
            analysis.get("version") == "1.0",
        )
    )

    duration_metric = metrics.get("DurationTime", {})
    duration_analysis = (
        analysis.get("metrics", {})
        .get("DurationTime", {})
    )

    checks.append(
        check(
            "DurationTime analysis status",
            duration_analysis.get("status") == "analyzed",
            "Recibido: {!r}".format(
                duration_analysis.get("status")
            ),
        )
    )

    duration_points = duration_metric.get("points") or []
    duration_sources = duration_analysis.get("sources") or []

    checks.append(
        check(
            "DurationTime has one analyzed source",
            len(duration_sources) == 1,
        )
    )

    if duration_points and duration_sources:
        point = duration_points[0]
        source = duration_sources[0]
        snapshot = source.get("at_max_input", {})

        expected_cv = None
        if (
            point.get("mean") is not None
            and point.get("stddev") is not None
            and abs(float(point["mean"])) > 0
        ):
            expected_cv = abs(
                float(point["stddev"]) /
                float(point["mean"])
            )

        expected_outlier_rate = (
            float(point.get("outliers_removed", 0)) /
            float(point.get("samples_total", 1))
        )

        checks.append(
            check(
                "DurationTime CV independently recomputed",
                close(
                    snapshot.get("coefficient_of_variation"),
                    expected_cv,
                ),
                "Expected {!r}, got {!r}".format(
                    expected_cv,
                    snapshot.get("coefficient_of_variation"),
                ),
            )
        )

        checks.append(
            check(
                "DurationTime outlier rate independently recomputed",
                close(
                    snapshot.get("outlier_rate"),
                    expected_outlier_rate,
                ),
            )
        )

        checks.append(
            check(
                "One InputSize -> trend insufficient_points",
                source.get("trend", {}).get("status")
                == "insufficient_points",
            )
        )

        checks.append(
            check(
                "One InputSize -> scaling insufficient_points",
                source.get("observed_scaling", {}).get("status")
                == "insufficient_points",
            )
        )

    energy = (
        analysis.get("metrics", {})
        .get("EnergyPkg", {})
    )
    checks.append(
        check(
            "EnergyPkg remains analytically unavailable",
            energy.get("status") == "unavailable",
        )
    )
    checks.append(
        check(
            "EnergyPkg keeps metric reason",
            energy.get("metric_status") == "not_counted",
            "Recibido: {!r}".format(
                energy.get("metric_status")
            ),
        )
    )

    methodology = analysis.get("methodology", {})
    checks.append(
        check(
            "No normative classification in methodology",
            methodology.get("nature")
            == "deterministic_descriptive",
        )
    )

    print("")
    passed = sum(1 for item in checks if item)
    total = len(checks)

    print("RESULTADO")
    print("=========")
    print("{}/{} checks passed".format(passed, total))

    if passed == total:
        print("RESULT: PASS")
        return 0

    print("RESULT: FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(main())
