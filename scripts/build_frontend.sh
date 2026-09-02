#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_DIR="${ROOT_DIR}/Client/my-app"
BUILD_DIR="${APP_DIR}/build"
FLASK_FRONTEND_DIR="${ROOT_DIR}/Server/webapp/frontend"

echo "============================================================"
echo " Performance System - build frontend"
echo "============================================================"
echo
echo "Proyecto:        ${ROOT_DIR}"
echo "React:           ${APP_DIR}"
echo "Build:           ${BUILD_DIR}"
echo "Destino Flask:   ${FLASK_FRONTEND_DIR}"
echo

for command in npm rsync; do
    if ! command -v "${command}" >/dev/null 2>&1; then
        echo "ERROR: no se encontró '${command}' en PATH." >&2
        exit 1
    fi
done

if [[ ! -f "${APP_DIR}/package.json" ]]; then
    echo "ERROR: no existe ${APP_DIR}/package.json" >&2
    exit 1
fi

if [[ ! -f "${APP_DIR}/package-lock.json" ]]; then
    echo "ERROR: no existe ${APP_DIR}/package-lock.json" >&2
    exit 1
fi

cd "${APP_DIR}"

if [[ "${SKIP_NPM_CI:-0}" == "1" ]]; then
    echo "==> Dependencias: se omite npm ci (SKIP_NPM_CI=1)"
else
    echo "==> Instalando dependencias exactas desde package-lock.json"
    npm ci
fi

if [[ "${RUN_FRONTEND_TESTS:-0}" == "1" ]]; then
    echo
    echo "==> Ejecutando tests frontend"
    CI=true npm test -- --watchAll=false
fi

echo
echo "==> Generando build de producción"
npm run build

if [[ ! -f "${BUILD_DIR}/index.html" ]]; then
    echo "ERROR: el build no generó index.html." >&2
    exit 1
fi

echo
echo "==> Sincronizando build con Flask"
mkdir -p "${FLASK_FRONTEND_DIR}"

rsync -a --exclude '/index.html' \
    "${BUILD_DIR}/" \
    "${FLASK_FRONTEND_DIR}/"

# Conserva temporalmente los assets con hash del release anterior.
# Una pestaña abierta antes del despliegue puede terminar de cargarlos.
# index.html se publica al final mediante un rename atómico.
INDEX_CANDIDATE="${FLASK_FRONTEND_DIR}/.index.html.next.$$"
trap 'rm -f "${INDEX_CANDIDATE}"' EXIT

cp "${BUILD_DIR}/index.html" "${INDEX_CANDIDATE}"
chmod 0644 "${INDEX_CANDIDATE}"
mv -f "${INDEX_CANDIDATE}" "${FLASK_FRONTEND_DIR}/index.html"

trap - EXIT

echo
echo "==> Verificando sincronización"

sync_mismatch=0

while IFS= read -r -d '' source_file; do
    relative_path="${source_file#${BUILD_DIR}/}"
    destination_file="${FLASK_FRONTEND_DIR}/${relative_path}"

    if [[ ! -f "${destination_file}" ]] ||
       ! cmp -s "${source_file}" "${destination_file}"; then
        echo "ERROR: archivo no sincronizado: ${relative_path}" >&2
        sync_mismatch=1
    fi
done < <(find "${BUILD_DIR}" -type f -print0)

if [[ "${sync_mismatch}" -ne 0 ]]; then
    echo "ERROR: el build vigente no quedó sincronizado con Flask." >&2
    exit 1
fi

echo
echo "OK: frontend publicado; se conservaron assets hash de releases anteriores."
