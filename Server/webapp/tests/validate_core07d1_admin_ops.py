#!/usr/bin/env python3
from pathlib import Path
import os

def root():
    p=Path(os.getcwd()).resolve()
    for r in [p,*p.parents]:
        if (r/"Client/my-app/src/App.js").is_file(): return r
    raise SystemExit(1)

R=root()
app=(R/"Client/my-app/src/App.js").read_text()
layout=(R/"Client/my-app/src/screens/AdminLayout.js").read_text()
access=(R/"Client/my-app/src/screens/AdminAccessRequests.js").read_text()
audit=(R/"Client/my-app/src/screens/AdminAuditLog.js").read_text()
checks=[
("App importa nuevas vistas", 'import AdminLayout' in app and 'import AdminAccessRequests' in app and 'import AdminAuditLog' in app),
("Rutas admin anidadas", 'path="/admin"' in app and 'path="access-requests"' in app and 'path="audit-log"' in app),
("Layout navega 3 secciones", "/admin/users" in layout and "/admin/access-requests" in layout and "/admin/audit-log" in layout),
("Solicitudes usa API real", "/api/admin/access-requests?" in access),
("Solicitudes aprueba/rechaza", 'mode==="approve"' in access and '"reject"' in access),
("Solicitudes confirma acción", "window.confirm" in access),
("Auditoría usa API real", "/api/admin/audit-log?" in audit),
("Auditoría usa rango de fecha inclusivo", "T23:59:59.999999" in audit),
("Sin mocks nuevos", "(mock)" not in access and "(mock)" not in audit),
]
passed=0
for name,ok in checks:
    print(f"{name:<58} {'PASS' if ok else 'FAIL'}")
    passed+=bool(ok)
print()
print(f"CORE-07D-1: {passed}/{len(checks)}")
if passed!=len(checks): raise SystemExit(1)
print("RESULT: PASS")
