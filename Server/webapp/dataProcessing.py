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
valid_metrics = ['DurationTime', 'Instructions', 'cpu-clock', 'task-clock']

# === 📄 LECTURA DE CSV ===
def read_csv_data(name):
    print(f"📥 Buscando CSV para {name} en {STATIC_DIR}")
    for file in os.listdir(STATIC_DIR):
        print(f"🔎 Revisando archivo: {file}")
        if file.startswith(name + "Results") and file.endswith(".csv"):
            path = os.path.join(STATIC_DIR, file)
            print(f"✅ Intentando leer: {path}")
            try:
                df = pd.read_csv(path, error_bad_lines=False, warn_bad_lines=True)
                return df, file
            except Exception as e:
                print(f"❌ Error leyendo {file}: {e}")
    raise FileNotFoundError(f"No se encontró CSV para {name}")



# === 📈 FUNCION PRINCIPAL DE GRAFICO POR METRICA ===
def plot_metric(df, metric, test_name, index):
    df = df.replace('<not-counted>', np.nan)

    try:
        df[metric] = pd.to_numeric(df[metric], errors='coerce')
        df['InputSize'] = pd.to_numeric(df['InputSize'], errors='coerce')
    except KeyError:
        print(f"❌ Falta columna '{metric}' o 'InputSize'.")
        return

    grouped = df.groupby('InputSize')[metric]
    mean_values = grouped.mean()
    std_values = grouped.std()

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=mean_values.index,
        y=mean_values.values,
        error_y=dict(type='data', array=std_values.values, visible=True),
        mode='lines+markers',
        name=metric
    ))

    fig.update_layout(
        title=f"{metric} vs Input Size",
        xaxis_title="Input Size",
        yaxis_title=metric,
        template='plotly_white'
    )

    output_dir = os.path.join(STATIC_DIR, test_name)
    os.makedirs(output_dir, exist_ok=True)
    fig_path = os.path.join(output_dir, f"fig{index}.html")
    fig.write_html(fig_path)
    print(f"[✅] Gráfico guardado en: {fig_path}")

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

        fig.add_trace(go.Scatter(
            x=mean_values.index,
            y=mean_values.values,
            error_y=dict(type='data', array=std_values.values, visible=True),
            mode='lines+markers',
            name=fname
        ))

    # Etiquetas personalizadas para el eje Y
    metric_y_labels = {
        "Instructions": "Instrucciones (unidades)",
        "CpuCycles": "Ciclos CPU",
        "TaskClock": "Tiempo de tarea (ms)",
        "CpuClock": "Reloj CPU (ms)",
        "Branches": "Branches (unidades)",
        "BranchMisses": "Branch Misses (unidades)",
        "LLCLoads": "LLC Loads (unidades)",
        "LLCLoadMisses": "LLC Load Misses (unidades)",
        "LLCStores": "LLC Stores (unidades)",
        "LLCStoreMisses": "LLC Store Misses (unidades)",
        "L1DcacheLoads": "L1D Loads (unidades)",
        "L1DcacheLoadMisses": "L1D Load Misses (unidades)",
        "L1DcacheStores": "L1D Stores (unidades)",
        "CacheReferences": "Referencias Caché (unidades)",
        "CacheMisses": "Fallos Caché (unidades)",
        "PageFaults": "Page Faults",
        "MajorFaults": "Major Faults",
        "StartTime": "Start Time (ms)",
        "EndTime": "End Time (ms)",
        "DurationTime": "Duración total (ms)"
    }

    fig.update_layout(
        xaxis_title="Input Size",
        yaxis_title=metric_y_labels.get(metric, metric),
        template='plotly_white',
        showlegend=True  # 🔥 Forzar mostrar leyenda siempre
    )

    fig_path = os.path.join(output_dir, f"{metric}.html")
    fig.write_html(fig_path)
    print(f"[✅] Gráfico guardado: {fig_path}")

# === 🔁 GRAFICAR TODAS LAS MÉTRICAS ===
def graph_results(names, fileNames, input_size):
    print("📊 Iniciando generación de gráficos combinados en HTML con Plotly...")

    dataframes = []
    display_names = []

    for name, fname in zip(names, fileNames):
        try:
            df, filename = read_csv_data(name)
            df = df.replace('<not-counted>', np.nan)
            df = df.copy()
            df['InputSize'] = pd.to_numeric(df['InputSize'], errors='coerce')
            df['source'] = fname
            print (fname)
            dataframes.append(df)
            display_names.append(fname)
            print(f"📄 CSV: {filename}")
            print(f"🧪 Columnas encontradas: {df.columns.tolist()}")
        except Exception as e:
            print(f"❌ Error leyendo {name}: {e}")

    if not dataframes:
        print("❌ No hay datos válidos para graficar.")
        return

    all_data = pd.concat(dataframes, ignore_index=True)
    print(f"📂 Columnas encontradas en CSV de {name}: {df.columns.tolist()}")

    exclude_cols = ["InputSize", "Increment", "StartTime", "EndTime", "source"]
    metric_columns = [col for col in all_data.columns if col not in exclude_cols]

    output_dirname = names[-1]  # último nombre de test (sirve para 1 o más)
    output_dir = os.path.join(STATIC_DIR, output_dirname)
    os.makedirs(output_dir, exist_ok=True)

    for i, metric in enumerate(metric_columns):
        print(f"📈 Procesando: {name} - {metric}")
        plot_metric_multi(all_data, metric, output_dir)
    combined_csv_path = os.path.join(output_dir, "CombinedResults.csv")
    all_data.to_csv(combined_csv_path, index=False)
    print(f"[✅] CSV combinado guardado en: {combined_csv_path}")
    print("✅ ¡Gráficos combinados generados correctamente!")