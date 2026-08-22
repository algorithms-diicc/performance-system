"""Fallback mínimo para tests que sustituyen la generación de gráficos.

El entorno oficial instala Plotly desde requirements.txt. Algunos sandboxes de
Codex no lo incluyen; estas suites inyectan ``graph_results``/``plot_metric`` y
solo necesitan que el import de dataProcessing sea resoluble.
"""

from types import ModuleType
import sys


def ensure_plotly_importable():
    try:
        import plotly.graph_objects  # noqa: F401
        return
    except ModuleNotFoundError:
        pass

    plotly = ModuleType("plotly")
    graph_objects = ModuleType("plotly.graph_objects")

    class UnavailableFigure:
        def __init__(self, *args, **kwargs):
            raise RuntimeError(
                "Plotly no está instalado en este sandbox de tests."
            )

    graph_objects.Figure = UnavailableFigure
    plotly.graph_objects = graph_objects
    sys.modules.setdefault("plotly", plotly)
    sys.modules.setdefault("plotly.graph_objects", graph_objects)
