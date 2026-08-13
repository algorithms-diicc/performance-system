# Performance System — Frontend

Frontend React de **Performance System**.

La documentación principal de arquitectura, instalación, PostgreSQL, configuración y despliegue se encuentra en:

```text
../../README.md
```

## Desarrollo

Desde `Client/my-app`:

```bash
npm ci
npm start
```

El servidor React de desarrollo utiliza el backend configurado en `package.json`, actualmente:

```text
http://localhost:5000
```

## Tests

```bash
CI=true npm test -- --watchAll=false
```

## Build de producción

El procedimiento recomendado se ejecuta desde la raíz del repositorio:

```bash
./scripts/build_frontend.sh
```

El script instala las dependencias desde `package-lock.json`, genera el build de producción y sincroniza el resultado con:

```text
Server/webapp/frontend/
```

En producción, Flask/Gunicorn sirve directamente ese frontend compilado. `npm start` se utiliza únicamente durante desarrollo.

Los directorios `build/` y `Server/webapp/frontend/` son artefactos generados y no deben versionarse.
