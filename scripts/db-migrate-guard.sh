#!/usr/bin/env bash
#
# GUARD DE MIGRACIONES.
#
# ═══ POR QUÉ EXISTE ═══
#
# `npm run db:migrate` era `npx prisma migrate dev` pelado. Contra esta base
# —que es producción— eso hace dos cosas peligrosas:
#
#   1. CREA Y BORRA UNA BASE SOMBRA en el mismo endpoint, porque el datasource
#      no declaraba `shadowDatabaseUrl`.
#   2. Cuando detecta drift, OFRECE RESETEAR: «We need to reset the "public"
#      schema… All data will be lost. Do you want to continue?». Un `y` y es el
#      20-may-2026 otra vez.
#
# Y no era una posibilidad teórica: el guard de `db push` recomendaba
# literalmente `npx prisma migrate dev --name <desc>` como la alternativa
# segura, y el commit b4e6ce51 del 22-sep-2026 —el que puso el historial al
# día— terminaba diciendo «de aquí en adelante los cambios de esquema deberían
# ir por migración y no por db push». O sea que las dos señales del propio
# proyecto apuntaban a un comando sin ninguna protección.
#
# Hoy el drift es cero, y eso es lo único que sostenía la situación. El drift
# vuelve con un solo `db push` que nadie acompañe de migración.
#
# ═══ QUÉ HACE ═══
#
#   · ECHO del host TARGET antes de nada. Si ves un host inesperado, ABORTA.
#   · Bloquea SIEMPRE `reset` y `--force-reset`, en cualquier posición.
#   · Contra producción exige ALLOW_PROD_MIGRATE=YES_EXPLICIT.
#   · Contra producción usa `migrate deploy` —que aplica lo pendiente y NUNCA
#     propone un reset— en vez de `migrate dev`. `dev` es para desarrollo: crea
#     base sombra y hace preguntas destructivas.
#   · `--guard-dry-run` enseña lo que haría sin ejecutar nada.
#
# Para crear una migración nueva SIN aplicarla (el flujo correcto aquí):
#     npx prisma migrate diff \
#       --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma \
#       --script > prisma/migrations/<timestamp>_<nombre>/migration.sql
#     npm run db:migrate            # la aplica con migrate deploy
#
set -euo pipefail

ARGS=("$@")
DRY_RUN=0

for a in "${ARGS[@]:-}"; do
    case "$a" in
        --guard-dry-run) DRY_RUN=1 ;;
        *reset*|*force-reset*)
            cat <<'EOF'
🛑 BLOQUEADO — este guard no ejecuta NUNCA un reset.

Fue lo que causó la pérdida del 20-may-2026: residentes, medicamentos,
horarios e historial clínico. No volvió.

Si Prisma sugiere un reset es porque el historial de migraciones no
reproduce la base. PARA y reporta. La salida correcta es poner el
historial al día sin ejecutar nada, como se hizo el 22-sep-2026:

    1. Recupera el datamodel viejo de git (el commit del último baseline).
    2. Comprueba que reproduce ese baseline:
         npx prisma migrate diff --from-empty \
           --to-schema-datamodel <viejo.prisma> --script
    3. Calcula el delta contra la base:
         npx prisma migrate diff --from-schema-datamodel <viejo.prisma> \
           --to-url "$DIRECT_URL" --script
    4. Guárdalo como migración y márcala:
         npx prisma migrate resolve --applied <nombre>
       (eso NO ejecuta el SQL: solo registra que la base ya está así)
EOF
            exit 1
            ;;
    esac
done

# La URL que Prisma va a usar de verdad, sin imprimir credenciales.
URL="${DIRECT_URL:-${DATABASE_URL:-}}"
if [[ -z "$URL" && -f .env ]]; then
    URL="$(grep -E '^DIRECT_URL=' .env | head -1 | sed 's/^DIRECT_URL=//' | tr -d '"' || true)"
    [[ -z "$URL" ]] && URL="$(grep -E '^DATABASE_URL=' .env | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' || true)"
fi
HOST="$(printf '%s' "$URL" | sed -E 's|.*://[^@]*@([^/:?]+).*|\1|')"

# Mismo patrón que db-push-guard.sh. Si cambia el endpoint, cambian los dos.
PROD_HOST_PATTERN='ep-wispy-queen-ae20881h'
IS_PROD=false
[[ "$HOST" == *"$PROD_HOST_PATTERN"* ]] && IS_PROD=true

echo "═══════════════════════════════════════════════════════════════"
echo "🎯 migrate target"
echo "   host:  ${HOST:-(no se pudo leer)}"
echo "   prod?: $IS_PROD"
[[ $DRY_RUN -eq 1 ]] && echo "   mode:  DRY-RUN (no ejecuta nada)"
echo "═══════════════════════════════════════════════════════════════"

if [[ $DRY_RUN -eq 1 ]]; then
    echo "DRY-RUN: se habría ejecutado $( [[ "$IS_PROD" == true ]] && echo 'prisma migrate deploy' || echo 'prisma migrate dev' )"
    exit 0
fi

if [[ "$IS_PROD" == true && "${ALLOW_PROD_MIGRATE:-}" != "YES_EXPLICIT" ]]; then
    cat <<'EOF'
🛑 BLOQUEADO — host es PRODUCCIÓN. Confirmación explícita requerida.

   Para aplicar migraciones contra prod:
       ALLOW_PROD_MIGRATE=YES_EXPLICIT npm run db:migrate

   Antes:
     1. Snapshot reciente en Neon.
     2. Confirma con el dueño del proyecto (Andrés).
     3. Lee el SQL de lo que está pendiente:
          npx prisma migrate status

   Contra prod se usa `migrate deploy`, NO `migrate dev`: aplica lo que
   está pendiente y no propone resetear nunca.
EOF
    exit 1
fi

if [[ "$IS_PROD" == true ]]; then
    echo "✅ Guard pasado. Ejecutando: npx prisma migrate deploy"
    npx prisma migrate deploy
else
    echo "✅ Guard pasado (no es prod). Ejecutando: npx prisma migrate dev ${ARGS[*]:-}"
    npx prisma migrate dev "${ARGS[@]:-}"
fi
