import os
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
    "BranchMissRate": "Tasa fallos branches (%)"
}

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
        sub_df = all_data[all_data["source"] == fname]

        try:
            sub_df[metric] = pd.to_numeric(sub_df[metric], errors='coerce')
        except KeyError:
            print(f"❌ Métrica '{metric}' no encontrada en {fname}.")
            continue

        grouped = sub_df.groupby("InputSize")[metric]
        mean_values = grouped.mean()
        std_values = grouped.std()

        # Si es rate, convertir a porcentaje
        if metric in ["CacheMissRate", "BranchMissRate"]:
            mean_values = mean_values * 100
            std_values = std_values * 100

        fig.add_trace(go.Scatter(
            x=mean_values.index,
            y=mean_values.values,
            error_y=dict(type='data', array=std_values.values, visible=True),
            mode='lines+markers',
            name=fname
        ))

    fig.update_layout(
        title=f"{metric} vs Input Size",
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

    for name, fname in zip(names, fileNames):
        try:
            df, filename = read_csv_data(name)
            df = df.replace('<not-counted>', np.nan)
            df = df.copy()
            df['InputSize'] = pd.to_numeric(df['InputSize'], errors='coerce')
            # === 🔥 Calcular métricas derivadas ===
            if 'Instructions' in df.columns and 'CpuCycles' in df.columns:
                df['Instructions'] = pd.to_numeric(df['Instructions'], errors='coerce')
                df['CpuCycles'] = pd.to_numeric(df['CpuCycles'], errors='coerce')
                df['IPC'] = df['Instructions'] / df['CpuCycles']

            if 'CacheMisses' in df.columns and 'CacheReferences' in df.columns:
                df['CacheMisses'] = pd.to_numeric(df['CacheMisses'], errors='coerce')
                df['CacheReferences'] = pd.to_numeric(df['CacheReferences'], errors='coerce')
                df['CacheMissRate'] = df['CacheMisses'] / df['CacheReferences']

            if 'BranchMisses' in df.columns and 'Branches' in df.columns:
                df['BranchMisses'] = pd.to_numeric(df['BranchMisses'], errors='coerce')
                df['Branches'] = pd.to_numeric(df['Branches'], errors='coerce')
                df['BranchMissRate'] = df['BranchMisses'] / df['Branches']
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

    # Métricas que se quitan del gráfico individual (pero quedan en CSV)
    skip_metrics = ["Instructions", "CpuCycles", "CacheMisses", "CacheReferences", "Branches", "BranchMisses"]

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
    print("✅ ¡Gráficos combinados generados correctamente!")
