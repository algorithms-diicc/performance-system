import importlib
import os
import sys
import tempfile
import unittest
from types import ModuleType
from unittest.mock import patch


data_processing_stub = ModuleType("Server.webapp.dataProcessing")
data_processing_stub.graph_results = lambda *_args, **_kwargs: None
socket_utils_stub = ModuleType("Server.webapp.socketUtils")
socket_utils_stub.escribir_estado = lambda *_args, **_kwargs: None
socket_utils_stub.slave_serve = lambda *_args, **_kwargs: None

with patch.dict(
    sys.modules,
    {
        "Server.webapp.dataProcessing": data_processing_stub,
        "Server.webapp.socketUtils": socket_utils_stub,
    },
):
    app_module = importlib.import_module("Server.webapp.app")


class FrontendDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)

        frontend_dir = self.tempdir.name
        static_js_dir = os.path.join(frontend_dir, "static", "js")
        os.makedirs(static_js_dir)

        self.index_body = b"<!doctype html><title>frontend-index</title>"
        with open(os.path.join(frontend_dir, "index.html"), "wb") as handle:
            handle.write(self.index_body)
        with open(os.path.join(static_js_dir, "main.hash.js"), "wb") as handle:
            handle.write(b"window.frontendLoaded = true;")

        self.frontend_patch = patch.object(
            app_module,
            "FRONTEND_DIR",
            frontend_dir,
        )
        self.frontend_patch.start()
        self.addCleanup(self.frontend_patch.stop)

        app_module.app.config.update(TESTING=True, SECRET_KEY="test-only")
        self.client = app_module.app.test_client()

    def _get(self, path):
        response = self.client.get(path)
        self.addCleanup(response.close)
        return response

    def test_index_and_spa_routes_are_not_stored(self):
        for path in ("/", "/profile", "/auth01-spa-route-check"):
            with self.subTest(path=path):
                response = self._get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, self.index_body)
                self.assertEqual(response.headers["Cache-Control"], "no-store")
                self.assertTrue(response.content_type.startswith("text/html"))

    def test_existing_static_assets_are_immutable_with_correct_mime(self):
        response = self._get("/static/js/main.hash.js")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, b"window.frontendLoaded = true;")
        self.assertTrue(response.content_type.startswith("text/javascript"))
        self.assertEqual(
            response.headers["Cache-Control"],
            "public, max-age=31536000, immutable",
        )

    def test_missing_static_assets_return_404_instead_of_index(self):
        for path in (
            "/static/js/missing.js",
            "/static/css/missing.css",
            "/static",
        ):
            with self.subTest(path=path):
                response = self._get(path)
                self.assertEqual(response.status_code, 404)
                self.assertNotEqual(response.data, self.index_body)

    def test_missing_api_route_remains_404(self):
        response = self._get("/api/auth01-missing")
        self.assertEqual(response.status_code, 404)
        self.assertNotEqual(response.data, self.index_body)


if __name__ == "__main__":
    unittest.main()
