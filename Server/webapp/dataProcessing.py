from flask import Flask, request, render_template, abort, url_for, redirect, make_response, jsonify
from flask_cors import CORS
import matplotlib.pyplot as plt
import pandas as pd
import subprocess
import random
import socket
import json
import threading as th
import time
from statistics import mean
import plotly.graph_objects as go
import plotly.offline as pyo
import sys
import numpy as np
import os

# === RUTAS ABSOLUTAS ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "webapp", "static")

os.makedirs(STATIC_DIR, exist_ok=True)

# === DEFINICIONES DE ESTILO PARA GRÁFICAS ===
color = ['#5DADE2', '#48C9B0', '#F4D03F', '#EC7063', '#AF7AC5', '#F5B041', '#85C1E9']

unidadesdemedida = [
    'clock ticks', 'clock ticks', 'Faults', 'Faults', 'Switches', 'Migrations', 'Nanoseconds',
    'Normalized clock ticks', 'Normalized clock ticks'
]
titulos = [
    'CPU Clock', 'Task Clock', 'Page Faults', 'Major Faults',
    'Context Switches', 'CPU Migrations', 'Execution Duration',
    'Normalized CPU Clock', 'Normalized Task Clock'
]

def create_directory(names):
    for name in names:
        path = os.path.join(STATIC_DIR, name)
        print("Creating directory for " + path + "!")
        os.makedirs(path, exist_ok=True)

def read_csv_data(name):
    # Intenta primero buscar sin subcarpeta
    result_path_direct = os.path.join(STATIC_DIR, f"{name}Results0.csv")
    if os.path.exists(result_path_direct):
        if os.path.getsize(result_path_direct) == 0:
            raise ValueError(f"El archivo {result_path_direct} está vacío.")
        return pd.read_csv(result_path_direct)

    # Si no existe, intenta con subcarpeta
    result_path_nested = os.path.join(STATIC_DIR, name, f"{name}Results0.csv")
    if not os.path.exists(result_path_nested):
        raise FileNotFoundError(f"El archivo {result_path_nested} no existe.")
    if os.path.getsize(result_path_nested) == 0:
        raise ValueError(f"El archivo {result_path_nested} está vacío.")
    return pd.read_csv(result_path_nested)


def calculate_normalized_power(csvobj):
    required_columns = ['cpu-clock', 'task-clock', 'duration_time']
    for col in required_columns:
        if col not in csvobj.columns:
            raise ValueError(f"El archivo CSV no tiene la columna necesaria: {col}")

    cpu_clock_normalized = []
    task_clock_normalized = []

    for j in range(len(csvobj)):
        duration_time = csvobj.loc[j, 'duration_time'] / float(10**9)
        if duration_time == 0:
            cpu_clock_normalized.append(0)
            task_clock_normalized.append(0)
        else:
            cpu_clock_normalized.append(round(csvobj.loc[j, 'cpu-clock'] / duration_time, 3))
            task_clock_normalized.append(round(csvobj.loc[j, 'task-clock'] / duration_time, 3))

    csvobj['cpu-clock-normalized'] = cpu_clock_normalized
    csvobj['task-clock-normalized'] = task_clock_normalized

    return csvobj

def save_normalized_data(name, csvobj):
    result_path = os.path.join(STATIC_DIR, name, f"{name}ResultsFinal.csv")
    csvobj.dropna(axis=1, how='all', inplace=True)  # ✅ Limpia columnas completamente vacías
    with open(result_path, 'x') as w:
        csvobj.to_csv(w, index=False)


def plot_common_plotly(columni, csvobjs, ax, names, nameFiles):
    fig = go.Figure()
    file_count = 0

    for name, csvobj in zip(names, csvobjs):
        df = csvobj.copy()
        test = df.iloc[:, columni]

        test.replace('<not-counted>', np.nan, inplace=True)
        test = pd.to_numeric(test, errors='coerce')

        mean_values = test.expanding().mean()
        fig.add_trace(go.Scatter(
            x=df.index,
            y=mean_values,
            mode='lines',
            name=f'Promedio - {titulos[columni]} - {nameFiles[file_count]}',
            line=dict(color='black', width=2)
        ))

        fig.add_trace(go.Scatter(
            x=df.index,
            y=test,
            mode='lines+markers',
            name=f'{titulos[columni]} - {nameFiles[file_count]}',
            line=dict(color=color[columni % len(color)])
        ))
        file_count += 1

    fig.update_layout(
        title=titulos[columni],
        xaxis_title='Iteraciones',
        yaxis_title=unidadesdemedida[columni],
        xaxis=dict(tickvals=list(range(0, len(df), max(1, len(df) // 10)))),
        template='plotly_white'
    )

    fig_path = os.path.join(STATIC_DIR, names[0], f"fig{columni}.html")
    fig.write_html(fig_path)

def plot_box_plotly(csvobjs, names, nameFiles, input_size):
    input_size = int(input_size)
    if csvobjs:
        data_columns = [col for col in csvobjs[0].columns if col != 'Increment']
        fig_number = 0 
        for col in data_columns:
            fig = go.Figure()
            file_count = 0
            for data, name in zip(csvobjs, names):
                data.replace('<not-counted>', np.nan, inplace=True)
                data[col] = pd.to_numeric(data[col], errors='coerce')

                grouped_data = data.groupby('Increment')[col].agg(['median', lambda x: x.quantile(0.75) - x.quantile(0.25)])
                grouped_data.columns = ['median', 'iqr']
                increments = np.linspace(input_size/30, input_size, len(grouped_data))

                fig.add_trace(go.Scatter(
                    x=increments,
                    y=grouped_data['median'],
                    error_y=dict(type='data', array=grouped_data['iqr'], visible=True),
                    mode='lines+markers',
                    name=f'{col} - {nameFiles[file_count]}',
                    line=dict(color=color[file_count % len(color)])
                ))
                file_count += 1

            fig.update_layout(
                title=f"{col}",
                yaxis_title=unidadesdemedida[fig_number],
                xaxis_title='Input Size',
                template='plotly_white'
            )

            fig_path = os.path.join(STATIC_DIR, names[0], f"fig{fig_number}.html")
            fig.write_html(fig_path)
            fig_number += 1

def plot_graphs(names, csvobjs, nameFiles):
    nameresult = names[0] + "Results0.csv"
    for columni in range(len(titulos)):
        fig, ax = plt.subplots()
        plot_common_plotly(columni, csvobjs, ax, names, nameFiles)
        plt.close(fig)

    for name in names:
        old_path = name + "Results0.csv"
        new_path = os.path.join(STATIC_DIR, name, old_path)
        os.replace(old_path, new_path)
    print("Done!")

def graph_results(names, nameFiles, input_size):
    print("name:", names)
    create_directory(names)
    all_csvobjs = []
    csvobj = read_csv_data(names[0])
    has_increment = csvobj.columns[0] == "Increment"
    print("names, size : ", nameFiles, input_size)
    if has_increment:
        for name in names:
            csvobj = read_csv_data(name)
            save_normalized_data(name, csvobj)
            all_csvobjs.append(csvobj)
        plot_box_plotly(all_csvobjs, names, nameFiles, input_size)
    else:
        for name in names:
            csvobj = read_csv_data(name)
            csvobj = calculate_normalized_power(csvobj)
            save_normalized_data(name, csvobj)
            final_csv_path = os.path.join(STATIC_DIR, name, f"{name}ResultsFinal.csv")
            all_csvobjs.append(pd.read_csv(final_csv_path))
        plot_graphs(names, all_csvobjs, nameFiles)