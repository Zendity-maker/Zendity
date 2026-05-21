#!/usr/bin/env bash
# scripts/db-push-guard.sh
#
# Wrapper de seguridad para `prisma db push`.
# Previene corridas accidentales contra producción que puedan
# disparar `--force-reset` y borrar la base de datos.
#
# Reglas:
#   1. NUNCA se permite el flag --force-reset (causó el desastre del 20-may-2026)
#   2. Si la DATABASE_URL apunta a Neon (*.neon.tech), exige ALLOW_PROD_PUSH=1
#   3. Cualquier otro caso (DB local, branch de dev) corre normalmente

set -euo pipefail

# Cargar DATABASE_URL desde .env si no está en el entorno
if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
    export $(grep -v '^#' .env | grep -E '^(DATABASE_URL|DIRECT_URL)=' | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL no está definido."
    exit 1
fi

# ============ Regla 1: bloquear --force-reset siempre ============
for arg in "$@"; do
    if [ "$arg" = "--force-reset" ]; then
        cat <<'EOF'
🛑 BLOQUEADO — `--force-reset` está prohibido en este proyecto.

Este flag DROPEA y recrea todas las tablas — borra toda la data.
Fue lo que causó la pérdida del 20-may-2026.

Si Prisma sugiere `--force-reset` es porque el schema está en drift.
La solución correcta es generar una migration formal:

    npx prisma migrate dev --name <descripcion>

Si necesitas resetear una DB de desarrollo (no prod), corre el
comando directamente con DATABASE_URL apuntando a tu branch de dev,
NO a través de este wrapper.
EOF
        exit 1
    fi
done

# ============ Regla 2: detectar producción ============
is_prod=false
if echo "$DATABASE_URL" | grep -qE "(neon\.tech|ep-wispy-queen-ae20881h)"; then
    is_prod=true
fi

if [ "$is_prod" = true ] && [ "${ALLOW_PROD_PUSH:-}" != "1" ]; then
    cat <<EOF
🛑 BLOQUEADO — DATABASE_URL apunta a producción (Neon).

   URL: $(echo "$DATABASE_URL" | sed 's|://[^@]*@|://***@|')

Para correr db push contra producción debes confirmar explícitamente:

    ALLOW_PROD_PUSH=1 npm run db:push

Antes de hacerlo:
  1. Verifica que tienes un snapshot reciente en Neon
  2. Confirma con el dueño del proyecto (Andrés)
  3. Considera si una migration formal es la opción correcta:
     npx prisma migrate dev --name <descripcion>
EOF
    exit 1
fi

# ============ OK — ejecutar prisma db push ============
echo "✅ Guard pasado. Ejecutando: npx prisma db push $*"
exec npx prisma db push "$@"
