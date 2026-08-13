import os
import json
import pandas as pd
import numpy as np
import plotly.graph_objects as go

# === 📁 RUTAS ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "webapp", "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# === 🎨 CONFIGURACIÓN DE COLOR Y FORMATO ===
color = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#8c564b']

# === 🏷️ Diccionario de etiquetas para el eje Y ===
metric_y_labels = {
    "Instructions": "Instrucciones (unidades)",
    "CpuCycles": "Ciclos CPU (unidades)",
    "TaskClock": "Tiempo de tarea (ms)",
    "CpuClock": "Reloj CPU (ms)",
    "Branches": "Branches (unidades)",
    "BranchMisses": "Fallos de predicción (unidades)",
    "LLCLoads": "LLC Loads (unidades)",
    "LLCLoadMisses": "Fallos LLC Load (unidades)",
    "LLCStores": "LLC Stores (unidades)",
    "LLCStoreMisses": "Fallos LLC Store (unidades)",
    "L1DcacheLoads": "L1D Loads (unidades)",
    "L1DcacheLoadMisses": "Fallos L1D Load (unidades)",
    "L1DcacheStores": "L1D Stores (unidades)",
    "CacheReferences": "Referencias Caché (unidades)",
    "CacheMisses": "Fallos Caché (unidades)",
    "PageFaults": "Page Faults (unidades)",
    "MajorFaults": "Major Faults (unidades)",
    "EnergyPkg": "Energía package CPU (J)",
    "EnergyCores": "Energía núcleos CPU (J)",
    "EnergyRAM": "Energía RAM (J)",
    "StartTime": "Start Time (ms)",
    "EndTime": "End Time (ms)",
    "DurationTime": "Duración total (ms)",
    "IPC": "Instructions per Cycle (ratio)",
    "CacheMissRate": "Tasa fallos caché (%)",
    "BranchMissRate": "Tasa fallos branches (%)",
    "BranchMissesPerMI": "Fallos de predicción por millón de instrucciones",
    "CacheMissesPerMI": "Fallos de caché por millón de instrucciones"
}

# CORE-06D-4: el HTML legacy conserva todas las muestras.
# El IQR deja de filtrar silenciosamente observaciones; la API canónica
# lo reporta como diagnóstico descriptivo.
USE_IQR_FILTER = False
MIN_N_AFTER_IQR = 5


AVAILABILITY_FILENAME = "MetricAvailability.json"
# CORE-06B-2: contrato científico de disponibilidad/IQR.
_DERIVED_AVAILABILITY_SPECS = {
    "IPC": ("Instructions", "CpuCycles"),
    "CacheMissRate": ("CacheMisses", "CacheReferences"),
    "BranchMissRate": ("BranchMisses", "Branches"),
    "BranchMissesPerMI": ("BranchMisses", "Instructions"),
    "CacheMissesPerMI": ("NormalizedCacheMisses", "NormalizedInstructions"),  # CORE-06B-4
}
_AVAILABILITY_META_COLUMNS = {
    "Increment",
    "InputSize",
    "StartTime",
    "EndTime",
    # CORE-06B-4: operandos auxiliares; no son métricas del dashboard.
    "NormalizedInstructions",
    "NormalizedCacheMisses",
    "source",
}
_UNSUPPORTED_MARKERS = {
    "<not-supported>",
    "<not supported>",
}
_NOT_COUNTED_MARKERS = {
    "<not-counted>",
    "<not counted>",
}


def _classify_availability_series(series):
    counts = {
        "rows_total": int(len(series)),
        "numeric": 0,
        "unsupported": 0,
        "not_counted": 0,
        "missing": 0,
    }

    for value in series.tolist():
        if pd.isna(value):
            counts["missing"] += 1
            continue

        text = str(value).strip()
        normalized = text.lower()

        if not text or normalized in {"nan", "none", "null"}:
            counts["missing"] += 1
        elif normalized in _UNSUPPORTED_MARKERS:
            counts["unsupported"] += 1
        elif normalized in _NOT_COUNTED_MARKERS:
            counts["not_counted"] += 1
        elif pd.notnull(pd.to_numeric(text, errors="coerce")):
            counts["numeric"] += 1
        else:
            counts["missing"] += 1

    return counts


def _collect_source_availability(df):
    result = {}

    for metric in df.columns:
        if metric in _AVAILABILITY_META_COLUMNS:
            continue

        result[metric] = _classify_availability_series(
            df[metric]
        )

    return result


def _availability_value_state(value):
    """Clasifica un valor crudo antes de convertir marcadores perf a NaN."""
    if pd.isna(value):
        return "missing", None

    text = str(value).strip()
    normalized = text.lower()

    if not text or normalized in {"nan", "none", "null"}:
        return "missing", None

    if normalized in _UNSUPPORTED_MARKERS:
        return "unsupported", None

    if normalized in _NOT_COUNTED_MARKERS:
        return "not_counted", None

    number = pd.to_numeric(text, errors="coerce")
    if pd.isna(number):
        return "missing", None

    return "numeric", float(number)


def _collect_derived_availability(df):
    """
    Propaga disponibilidad a métricas derivadas fila por fila.

    Una derivada sólo es numérica cuando ambos operandos son numéricos y
    el denominador es > 0. Si un operando está unsupported/not-counted,
    la derivada conserva esa causa.
    """
    result = {}

    for metric, (numerator_name, denominator_name) in (
        _DERIVED_AVAILABILITY_SPECS.items()
    ):
        if (
            numerator_name not in df.columns
            or denominator_name not in df.columns
        ):
            # CORE-06B-4: raws históricos (25 columnas) no contienen la
            # pareja simultánea necesaria para CacheMissesPerMI.
            if metric == "CacheMissesPerMI":
                result[metric] = {
                    "rows_total": int(len(df)),
                    "numeric": 0,
                    "unsupported": 0,
                    "not_counted": 0,
                    "missing": int(len(df)),
                }
            continue

        counts = {
            "rows_total": int(len(df)),
            "numeric": 0,
            "unsupported": 0,
            "not_counted": 0,
            "missing": 0,
        }

        for numerator_raw, denominator_raw in zip(
            df[numerator_name].tolist(),
            df[denominator_name].tolist(),
        ):
            numerator_state, numerator = _availability_value_state(
                numerator_raw
            )
            denominator_state, denominator = _availability_value_state(
                denominator_raw
            )

            states = {numerator_state, denominator_state}

            if "unsupported" in states:
                counts["unsupported"] += 1
            elif "not_counted" in states:
                counts["not_counted"] += 1
            elif "missing" in states:
                counts["missing"] += 1
            elif denominator is None or denominator <= 0:
                counts["missing"] += 1
            elif numerator is None:
                counts["missing"] += 1
            else:
                counts["numeric"] += 1

        result[metric] = counts

    return result


def _merge_availability_totals(target, source_metrics):
    for metric, counts in source_metrics.items():
        current = target.setdefault(
            metric,
            {
                "rows_total": 0,
                "numeric": 0,
                "unsupported": 0,
                "not_counted": 0,
                "missing": 0,
            },
        )

        for key in current:
            current[key] += int(counts.get(key, 0))


def _write_availability_sidecar(output_dir, sources, totals):
    payload = {
        "schema_version": "1.0",
        "description": (
            "Disponibilidad de métricas capturada antes de convertir "
            "marcadores de perf a NaN."
        ),
        "sources": sources,
        "metrics": totals,
    }

    path = os.path.join(
        output_dir,
        AVAILABILITY_FILENAME,
    )

    with open(path, "w", encoding="utf-8") as handle:
        json.dump(
            payload,
            handle,
            indent=2,
            ensure_ascii=False,
        )

    print(
        "[✅] Disponibilidad de métricas guardada:",
        path,
    )

def iqr_stats(series, min_n=5):
    """
    Devuelve media, std, n y si se aplicó IQR sobre 'series'.
    Si tras filtrar quedan <min_n observaciones, no se filtra.
    """
    s = pd.to_numeric(series, errors='coerce').dropna()
    if s.size < min_n:
        return pd.Series({"mean": s.mean(), "std": s.std(ddof=1), "n": s.size, "filtered": False})
    q1 = s.quantile(0.25); q3 = s.quantile(0.75)
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    s2 = s[(s >= lower) & (s <= upper)]

    # CORE-06B-2: el filtrado sólo se conserva cuando quedan al menos
    # min_n observaciones; si no, se usa la muestra original.
    if s2.size < min_n:
        return pd.Series({
            "mean": s.mean(),
            "std": s.std(ddof=1),
            "n": s.size,
            "filtered": False,
        })

    return pd.Series({
        "mean": s2.mean(),
        "std": s2.std(ddof=1),
        "n": s2.size,
        "filtered": True,
    })

def read_csv_data(name):
    print(f"📥 Buscando CSV para {name} en {STATIC_DIR}")
    for file in os.listdir(STATIC_DIR):
        if file.startswith(name + "Results") and file.endswith(".csv"):
            path = os.path.join(STATIC_DIR, file)
            print(f"✅ Intentando leer: {path}")
            try:
                df = pd.read_csv(path)
                return df, file
            except Exception as e:
                print(f"❌ Error leyendo {file}: {e}")
    raise FileNotFoundError(f"No se encontró CSV para {name}")

def plot_metric_multi(all_data, metric, output_dir):
    fig = go.Figure()

    for fname in all_data["source"].unique():
        sub_df = all_data[all_data["source"] == fname].copy()

        try:
            sub_df[metric] = pd.to_numeric(sub_df[metric], errors='coerce')
        except KeyError:
            print(f"❌ Métrica '{metric}' no encontrada en {fname}.")
            continue
        print("DEBUG metric:", metric, " source:", fname)
        print(sub_df[["InputSize", metric]].head().to_string())
        # --- cálculo de estadísticas por InputSize (robusto para pandas 1.1.5) ---
        if USE_IQR_FILTER:
            # Construir filas de stats a mano para evitar sorpresas de apply/reset_index
            rows = []
            for input_size, series in sub_df.groupby("InputSize")[metric]:
                st = iqr_stats(series, MIN_N_AFTER_IQR)  # -> Series con mean,std,n,filtered
                # normalizar tipos y NaN
                mean_val = float(st.get("mean", np.nan)) if pd.notnull(st.get("mean", np.nan)) else np.nan
                std_val  = float(st.get("std", 0.0)) if pd.notnull(st.get("std", np.nan)) else 0.0
                n_val    = int(st.get("n", 0)) if pd.notnull(st.get("n", np.nan)) else 0
                filtered = bool(st.get("filtered", False))
                rows.append({
                    "InputSize": pd.to_numeric(input_size, errors="coerce"),
                    "mean": mean_val,
                    "std": std_val,
                    "n": n_val,
                    "filtered": filtered
                })
            if not rows:
                print(f"⚠️  No hay datos para {metric} en {fname}.")
                continue

            stats = pd.DataFrame(rows).sort_values("InputSize")
            x_vals      = stats["InputSize"].values
            mean_values = stats["mean"].values
            std_values  = stats["std"].values
            n_vals      = stats["n"].values
            filtered_f  = stats["filtered"].values.astype(bool)
        else:
            grouped     = sub_df.groupby("InputSize")[metric]
            mean_values = grouped.mean()
            std_values  = grouped.std()
            x_vals      = mean_values.index.values
            n_series    = grouped.size()
            n_vals      = n_series.reindex(mean_values.index).values
            filtered_f  = np.array([False] * len(x_vals), dtype=bool)

        # Si es rate, convertir a porcentaje
        if metric in ["CacheMissRate", "BranchMissRate"]:
            mean_values = mean_values * 100
            std_values  = std_values * 100

        fig.add_trace(go.Scatter(
            x=x_vals,
            y=mean_values if isinstance(mean_values, np.ndarray) else mean_values.values,
            error_y=dict(
                type='data',
                array=(std_values if isinstance(std_values, np.ndarray) else std_values.values),
                visible=True
            ),
            mode='lines+markers',
            name=os.path.basename(fname),
            customdata=(np.c_[n_vals, filtered_f] if USE_IQR_FILTER else None),
            hovertemplate=(
                "Input Size=%{x}<br>"
                "Media=%{y:.3f}<br>"
                "n’=%{customdata[0]}<br>"
                "IQR aplicado=%{customdata[1]}"
                "<extra>%{fullData.name}</extra>"
            ) if USE_IQR_FILTER else None
        ))

    title_suffix = " (media±σ tras IQR)" if USE_IQR_FILTER else " (media±σ)"
    fig.update_layout(
        title=f"{metric} vs Input Size{title_suffix}",
        xaxis_title="Input Size",
        yaxis_title=metric_y_labels.get(metric, metric),
        template='plotly_white',
        showlegend=True
    )

    fig_path = os.path.join(output_dir, f"{metric}.html")
    fig.write_html(fig_path)
    print(f"[✅] Gráfico guardado: {fig_path}")


def graph_results(names, fileNames, input_size):
    print("📊 Iniciando generación de gráficos combinados en HTML con Plotly...")

    dataframes = []
    availability_sources = {}
    availability_totals = {}

    for name, fname in zip(names, fileNames):
        try:
            df, filename = read_csv_data(name)

            # Capturar la causa de indisponibilidad ANTES de convertir
            # <not-counted> a NaN. Esto permite distinguir posteriormente
            # "no soportado", "no contabilizado" y "sin datos".
            source_availability = _collect_source_availability(df)

            # CORE-06B-2: las derivadas heredan la causa de indisponibilidad
            # de sus operandos antes de perder los marcadores perf.
            source_availability.update(
                _collect_derived_availability(df)
            )

            availability_sources[fname] = source_availability
            _merge_availability_totals(
                availability_totals,
                source_availability,
            )

            df = df.replace('<not-counted>', np.nan)
            df = df.copy()
            df['InputSize'] = pd.to_numeric(df['InputSize'], errors='coerce')

            # === 🔥 Calcular métricas derivadas ===
            # IPC
            if 'Instructions' in df.columns and 'CpuCycles' in df.columns:
                df['Instructions'] = pd.to_numeric(df['Instructions'], errors='coerce')
                df['CpuCycles'] = pd.to_numeric(df['CpuCycles'], errors='coerce')
                df['IPC'] = df['Instructions'] / df['CpuCycles']

            # Tasas de caché (porcentaje) y branches (porcentaje)
            if 'CacheMisses' in df.columns and 'CacheReferences' in df.columns:
                df['CacheMisses'] = pd.to_numeric(df['CacheMisses'], errors='coerce')
                df['CacheReferences'] = pd.to_numeric(df['CacheReferences'], errors='coerce')
                df['CacheMissRate'] = df['CacheMisses'] / df['CacheReferences']

            if 'BranchMisses' in df.columns and 'Branches' in df.columns:
                df['BranchMisses'] = pd.to_numeric(df['BranchMisses'], errors='coerce')
                df['Branches'] = pd.to_numeric(df['Branches'], errors='coerce')
                df['BranchMissRate'] = df['BranchMisses'] / df['Branches']

            # ✅ Normalizados por instrucciones (robustos a 0/NaN/inf)
            if 'Instructions' in df.columns:
                instr = pd.to_numeric(df['Instructions'], errors='coerce')

                if 'BranchMisses' in df.columns:
                    miss_b = pd.to_numeric(df['BranchMisses'], errors='coerce')
                    df['BranchMissesPerMI'] = np.where(instr > 0, (miss_b / instr) * 1e6, np.nan)

            # CORE-06B-4:
            # CacheMissesPerMI usa exclusivamente operandos de una misma
            # ejecución perf.
            if (
                'NormalizedInstructions' in df.columns
                and 'NormalizedCacheMisses' in df.columns
            ):
                normalized_instr = pd.to_numeric(
                    df['NormalizedInstructions'],
                    errors='coerce',
                )
                normalized_misses = pd.to_numeric(
                    df['NormalizedCacheMisses'],
                    errors='coerce',
                )
                df['CacheMissesPerMI'] = np.where(
                    normalized_instr > 0,
                    (normalized_misses / normalized_instr) * 1e6,
                    np.nan,
                )
            else:
                df['CacheMissesPerMI'] = np.nan

            for col in ['BranchMissesPerMI', 'CacheMissesPerMI']:
                if col in df.columns:
                    df[col].replace([np.inf, -np.inf], np.nan, inplace=True)

            # Operandos auxiliares: permanecen en Results0.csv como evidencia,
            # pero no se exponen en CombinedResults/dashboard.
            df.drop(
                columns=['NormalizedInstructions', 'NormalizedCacheMisses'],
                errors='ignore',
                inplace=True,
            )

            df['source'] = fname
            dataframes.append(df)
            print(f"📄 CSV: {filename}")
            print(f"🧪 Columnas encontradas: {df.columns.tolist()}")
        except Exception as e:
            print(f"❌ Error leyendo {name}: {e}")

    if not dataframes:
        print("❌ No hay datos válidos para graficar.")
        return

    all_data = pd.concat(dataframes, ignore_index=True)
    exclude_cols = ["InputSize", "Increment", "StartTime", "EndTime", "source"]

    # 🎯 Ahora sí se grafican las métricas absolutas; deja fuera solo denominadores.
    skip_metrics = ["CpuCycles", "CacheReferences", "Branches"]  # quita "Instructions" si también quieres graficarla

    metric_columns = [col for col in all_data.columns if col not in exclude_cols and col not in skip_metrics]

    output_dirname = names[-1]
    output_dir = os.path.join(STATIC_DIR, output_dirname)
    os.makedirs(output_dir, exist_ok=True)

    for metric in metric_columns:
        print(f"📈 Procesando: {metric}")
        plot_metric_multi(all_data, metric, output_dir)

    # Guardar CSV combinado
    combined_csv_path = os.path.join(output_dir, "CombinedResults.csv")
    all_data.to_csv(combined_csv_path, index=False)
    print(f"[✅] CSV combinado guardado en: {combined_csv_path}")

    _write_availability_sidecar(
        output_dir,
        availability_sources,
        availability_totals,
    )

    print("✅ ¡Gráficos combinados generados correctamente!")