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
access_compact="".join(access.split())
checks=[
("App importa nuevas vistas", 'import AdminLayout' in app and 'import AdminAccessRequests' in app and 'import AdminAuditLog' in app),
("Rutas admin anidadas", 'path="/admin"' in app and 'path="access-requests"' in app and 'path="audit-log"' in app),
("Layout navega 3 secciones", "/admin/users" in layout and "/admin/access-requests" in layout and "/admin/audit-log" in layout),
("Solicitudes usa API real", "/api/admin/access-requests?" in access),
("Solicitudes conserva POST approve/reject", "/api/admin/access-requests/${item.id}/${mode}" in access and 'method:"POST"' in access_compact and '"approve"' in access and '"reject"' in access),
("Solicitudes usa ConfirmActionModal", 'importConfirmActionModalfrom"../components/ConfirmActionModal"' in access_compact and "<ConfirmActionModal" in access),
("Solicitudes no usa diálogos nativos", all(dialog not in access for dialog in ("window.confirm", "window.prompt", "window.alert"))),
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
