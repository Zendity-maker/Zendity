#!/usr/bin/env bash
# scripts/dr-restore.sh
#
# Script de RESTAURACIÓN ante desastre.
# Descarga un backup específico de R2 y lo aplica a una DB target.
#
# USO:
#   ./scripts/dr-restore.sh list                              # lista backups disponibles
#   ./scripts/dr-restore.sh restore <filename> <target-url>   # aplica backup a target
#
# EJEMPLOS:
#   # Listar todos los backups disponibles en R2
#   ./scripts/dr-restore.sh list
#
#   # Restaurar a una BRANCH DE PRUEBA en Neon (NO toca producción)
#   ./scripts/dr-restore.sh restore zendity-prod-2026-05-22_07-00-00-daily.sql.gz \
#     "postgresql://user:pass@ep-test-branch.neon.tech/neondb?sslmode=require"
#
#   # Restaurar a PRODUCCIÓN (requiere flag explícito — última opción)
#   ALLOW_PROD_RESTORE=1 ./scripts/dr-restore.sh restore <filename> "$DATABASE_URL"
#
# REQUISITOS PREVIOS:
#   - aws CLI instalado (brew install awscli)
#   - psql instalado (brew install libpq && brew link --force libpq)
#   - Variables de entorno R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
#     (cargarlas desde .env.r2 o exportarlas manualmente)

set -euo pipefail

# ── Cargar credenciales R2 ───────────────────────────────────────
if [ -f ".env.r2" ]; then
    export $(grep -v '^#' .env.r2 | xargs)
fi

if [ -z "${R2_ACCOUNT_ID:-}" ] || [ -z "${R2_BUCKET:-}" ]; then
    echo "❌ Configurar R2_ACCOUNT_ID y R2_BUCKET (en .env.r2 o como env vars)"
    exit 1
fi

R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
export AWS_DEFAULT_REGION="auto"

# ── Subcomandos ──────────────────────────────────────────────────

cmd_list() {
    echo "📦 Backups disponibles en R2 (bucket: $R2_BUCKET):"
    echo ""
    aws s3 ls "s3://${R2_BUCKET}/" --endpoint-url "$R2_ENDPOINT" \
        | grep -E "^.*zendity-prod-" \
        | sort -r \
        | head -30 \
        | awk '{printf "  %s  %s  %s\n", $1, $3" bytes", $4}'
}

cmd_restore() {
    local FILENAME="$1"
    local TARGET_URL="$2"

    if [ -z "$FILENAME" ] || [ -z "$TARGET_URL" ]; then
        echo "❌ Uso: $0 restore <filename> <target-url>"
        exit 1
    fi

    # ── Safety check: target NO debe ser producción salvo con flag explícito ──
    if echo "$TARGET_URL" | grep -qE "ep-wispy-queen-ae20881h"; then
        if [ "${ALLOW_PROD_RESTORE:-}" != "1" ]; then
            cat <<EOF
🛑 BLOQUEADO — el target URL apunta a PRODUCCIÓN.

Restaurar contra producción sobreescribe TODA la data actual.
Esta es una acción de DESASTRE — solo si la DB está corrupta o vacía.

Antes de ejecutar:
  1. Confirma que NO puedes restaurar desde Neon PITR (más seguro)
  2. Asegúrate de tener un snapshot fresh de la DB actual ANTES de restaurar
  3. Confirma con el dueño del proyecto

Si estás 100% seguro:
  ALLOW_PROD_RESTORE=1 $0 restore "$FILENAME" "<url>"
EOF
            exit 1
        else
            echo "⚠️  RESTORE CONTRA PRODUCCIÓN — confirmado por ALLOW_PROD_RESTORE=1"
            echo ""
            read -p "¿Estás SEGURO? Escribe 'RESTAURAR PRODUCCION' para continuar: " CONFIRM
            if [ "$CONFIRM" != "RESTAURAR PRODUCCION" ]; then
                echo "❌ Cancelado"
                exit 1
            fi
        fi
    fi

    local TMP_FILE="/tmp/${FILENAME}"

    echo "→ Descargando $FILENAME desde R2..."
    aws s3 cp "s3://${R2_BUCKET}/${FILENAME}" "$TMP_FILE" \
        --endpoint-url "$R2_ENDPOINT"

    if [ ! -f "$TMP_FILE" ]; then
        echo "❌ La descarga falló"
        exit 1
    fi

    local SIZE=$(du -h "$TMP_FILE" | cut -f1)
    echo "✅ Descargado: $SIZE"

    echo ""
    echo "→ Verificando integridad del dump..."
    local FIRST_LINE=$(gunzip -c "$TMP_FILE" | head -1)
    if [[ "$FIRST_LINE" != *"PostgreSQL database dump"* ]]; then
        echo "❌ El archivo no es un pg_dump válido"
        exit 1
    fi
    echo "✅ Dump válido"

    echo ""
    echo "→ Aplicando dump al target..."
    echo "   Target: $(echo "$TARGET_URL" | sed 's|://[^@]*@|://***@|')"
    echo ""

    gunzip -c "$TMP_FILE" | psql "$TARGET_URL" \
        --set ON_ERROR_STOP=on \
        --quiet \
        --no-psqlrc

    echo ""
    echo "✅ Restauración completa"
    echo ""
    echo "Verifica el estado de la DB target:"
    echo "  psql \"\$TARGET_URL\" -c 'SELECT COUNT(*) FROM \"User\"; SELECT COUNT(*) FROM \"Patient\";'"

    # Cleanup
    rm -f "$TMP_FILE"
}

# ── Dispatcher ──────────────────────────────────────────────────

case "${1:-}" in
    list)
        cmd_list
        ;;
    restore)
        cmd_restore "${2:-}" "${3:-}"
        ;;
    *)
        cat <<EOF
Uso:
  $0 list                              Lista backups disponibles
  $0 restore <filename> <target-url>   Restaura backup a target DB

Ver header del script para más detalles y ejemplos.
EOF
        exit 1
        ;;
esac
