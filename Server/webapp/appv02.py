"""Entrada de compatibilidad para instalaciones que aún apuntan a appv02.

La aplicación canónica vive en ``Server.webapp.app``. Mantener una segunda
implementación Flask había dejado rutas, comandos de shell y controles de
acceso antiguos disponibles si se iniciaba este módulo por error.
"""

import os

try:
    from .app import app
except ImportError:  # ejecución directa desde la raíz del repositorio
    from Server.webapp.app import app


if __name__ == "__main__":
    debug_enabled = os.getenv("FLASK_DEBUG", "0").strip().casefold() in {
        "1",
        "true",
        "yes",
    }
    app.run(host="0.0.0.0", debug=debug_enabled)
