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

rsync -a --delete \
    "${BUILD_DIR}/" \
    "${FLASK_FRONTEND_DIR}/"

echo
echo "==> Verificando sincronización"

if ! diff -qr "${BUILD_DIR}" "${FLASK_FRONTEND_DIR}"; then
    echo "ERROR: build y frontend Flask no son idénticos." >&2
    exit 1
fi

echo
echo "OK: frontend construido y sincronizado correctamente."
