# server/webapp/routes/metrics_routes.py

from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection
from ..utils.db_utils import db_cursor
from ..utils.auth_decorators import login_required
from ..utils.api_errors import (
    handle_api_errors,
    ValidationError,
    BadRequestError,
)

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api")


# ==========================
# GET /api/metrics/definitions
# ==========================

@metrics_bp.route("/metrics/definitions", methods=["GET"])
@login_required
@handle_api_errors
def get_metric_definitions():
    """
    Devuelve metadatos de las métricas disponibles para visualización.

    Por ahora la definición es estática en código. Más adelante podrías
    mover esto a una tabla en BD o a un archivo de configuración.

    Ejemplo:
      GET http://localhost:5000/api/metrics/definitions

      Respuesta:
      {
        "items": [
          {
            "key": "time_wall_ms",
            "label": "Tiempo total de ejecución",
            "unit": "ms",
            "category": "Tiempo"
          },
          ...
        ]
      }
    """
    items = [
        {
            "key": "time_wall_ms",
            "label": "Tiempo total de ejecución",
            "unit": "ms",
            "category": "Tiempo",
        },
        {
            "key": "cpu_time_ms",
            "label": "Tiempo CPU",
            "unit": "ms",
            "category": "CPU",
        },
        {
            "key": "instructions",
            "label": "Instrucciones ejecutadas",
            "unit": "count",
            "category": "CPU",
        },
        {
            "key": "cycles",
            "label": "Ciclos de CPU",
            "unit": "count",
            "category": "CPU",
        },
        {
            "key": "branch_misses",
            "label": "Fallos de predicción de salto",
            "unit": "count",
            "category": "CPU",
        },
        {
            "key": "cache_misses",
            "label": "Fallos de caché",
            "unit": "count",
            "category": "Memoria",
        },
        {
            "key": "memory_bytes",
            "label": "Uso de memoria",
            "unit": "bytes",
            "category": "Memoria",
        },
        {
            "key": "energy_joules",
            "label": "Energía consumida",
            "unit": "J",
            "category": "Energía",
        },
    ]

    return jsonify({"items": items}), 200


# ==========================
# GET /api/metrics/summary
# ==========================

@metrics_bp.route("/metrics/summary", methods=["GET"])
@login_required
@handle_api_errors
def get_metric_summary():
    """
    Resumen estadístico simple de una métrica para el usuario actual.

    Supone una tabla de métricas de forma (ejemplo genérico):

      metrics(
        id SERIAL PRIMARY KEY,
        execution_id INTEGER NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value DOUBLE PRECISION NOT NULL
      )

    Si tus columnas tienen otros nombres, ajusta el SQL en este endpoint.

    Parámetros de query:
      - metric: nombre interno de la métrica (ej: 'time_wall_ms', 'instructions')
      - scope (opcional, por ahora sólo soporta 'me')

    Ejemplo:
      GET http://localhost:5000/api/metrics/summary?metric=time_wall_ms

      Respuesta:
      {
        "metric": "time_wall_ms",
        "scope": "me",
        "samples": 12,
        "avg": 183.5,
        "min": 150.1,
        "max": 250.0
      }
    """
    user = g.current_user

    metric = request.args.get("metric", "", type=str).strip()
    scope = request.args.get("scope", "me", type=str)

    if not metric:
        raise ValidationError(
            "Debe indicar la métrica a resumir mediante el parámetro 'metric'.",
            extra={"field": "metric"},
        )

    if scope != "me":
        # Más adelante podrías soportar 'course', 'all', etc.
        raise BadRequestError("Por ahora sólo se soporta scope='me'.")

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Nota importante:
            #  - Ajusta 'metric_name' y 'metric_value' a tus columnas reales.
            #  - Filtramos sólo ejecuciones del usuario actual.
            cur.execute(
                """
                SELECT
                  COUNT(*)              AS samples,
                  AVG(m.metric_value)   AS avg_value,
                  MIN(m.metric_value)   AS min_value,
                  MAX(m.metric_value)   AS max_value
                FROM metrics m
                JOIN executions e ON e.id = m.execution_id
                JOIN submissions s ON s.id = e.submission_id
                WHERE m.metric_name = %s
                  AND s.user_id = %s;
                """,
                (metric, user["id"]),
            )
            row = cur.fetchone() or {
                "samples": 0,
                "avg_value": None,
                "min_value": None,
                "max_value": None,
            }

        return jsonify(
            {
                "metric": metric,
                "scope": "me",
                "samples": row["samples"] or 0,
                "avg": row.get("avg_value"),
                "min": row.get("min_value"),
                "max": row.get("max_value"),
            }
        ), 200

    finally:
        conn.close()
