#!/usr/bin/env bash
# scripts/db-push-guard.sh
#
# Wrapper de seguridad para `prisma db push`.
#
# HISTORIA:
#   - 20-may-2026: pérdida total de prod por `prisma db push --force-reset`.
#                  → Bug 1 del guard: bloquear --force-reset siempre.
#   - 09-jun-2026: push aditivo accidental a prod cuando la intención era branch.
#                  Causa: el guard no garantizaba qué `.env` usaría Prisma; el
#                  archivo `.env` del repo (apunta a prod) ganó sobre la
#                  DATABASE_URL pasada por línea de comando.
#                  → Bugs 2-4 corregidos en este reescrito.
#
# REGLAS:
#   1. NUNCA --force-reset (puede borrar la base entera).
#   2. Detección de prod por HOST EXPLÍCITO (no por "cualquier neon.tech").
#      Solo el host real de prod exige confirmación → el flag conserva su valor
#      semántico (antes cualquier branch lo exigía y se setteaba por costumbre).
#   3. ECHO del HOST TARGET antes de ejecutar → backstop visual. Si ves un host
#      que no esperas, ABORTA con Ctrl-C.
#   4. AISLAR a Prisma del `.env` del repo durante el push → la única fuente de
#      DATABASE_URL es la env var del shell (capturada ANTES de mover `.env`).
#      Sin esto, Prisma auto-carga `.env` y sobrescribe lo que pretendías.
#
# CONFIRMACIÓN DE PROD:
#     ALLOW_PROD_PUSH=YES_EXPLICIT npm run db:push
#   (Antes era =1; el valor es más visible y harder to typo accidentally.)
#
# DRY-RUN PARA PROBAR EL GUARD SIN TOCAR DB:
#     npm run db:push -- --guard-dry-run
#   Hace todas las validaciones y ECHO, pero NO ejecuta `prisma db push`.

set -euo pipefail

# ─── Identificador del host de PROD ─────────────────────────────────────
# Substring distintivo. Cacha tanto el directo como el -pooler:
#   ep-wispy-queen-ae20881h.c-2.us-east-2.aws.neon.tech
#   ep-wispy-queen-ae20881h-pooler.c-2.us-east-2.aws.neon.tech
PROD_HOST_PATTERN="ep-wispy-queen-ae20881h"

# ─── Detectar y consumir --guard-dry-run del argv antes de pasar al child ──
DRY_RUN=false
ARGS=()
for arg in "$@"; do
    if [ "$arg" = "--guard-dry-run" ]; then
        DRY_RUN=true
    else
        ARGS+=("$arg")
    fi
done

# ─── 1. CAPTURAR DATABASE_URL ANTES de mover .env ───────────────────────
# Orden de fuentes:
#   a) DATABASE_URL del shell (si vino por línea de comando)
#   b) .env del repo (si la del shell está vacía)
# Esta resolución ocurre AHORA. Lo que se decida aquí es lo que Prisma usará.
if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
    # Cargar SOLO DATABASE_URL y DIRECT_URL del .env; ignorar el resto.
    set +u  # xargs puede expandir vacío
    export $(grep -v '^#' .env | grep -E '^(DATABASE_URL|DIRECT_URL)=' | xargs -d '\n' 2>/dev/null || grep -v '^#' .env | grep -E '^(DATABASE_URL|DIRECT_URL)=' | xargs)
    set -u
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL no está definido (ni en shell ni en .env)."
    exit 1
fi

# DIRECT_URL es opcional (schema.prisma puede no usarlo). Si no hay, usar
# DATABASE_URL como fallback — Prisma acepta esto.
DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
export DATABASE_URL DIRECT_URL

# ─── 2. Bloquear --force-reset SIEMPRE ──────────────────────────────────
for arg in "${ARGS[@]:-}"; do
    if [ "$arg" = "--force-reset" ]; then
        cat <<'EOF'
🛑 BLOQUEADO — `--force-reset` está prohibido en este proyecto.

Este flag DROPEA y recrea todas las tablas — borra toda la data.
Fue lo que causó la pérdida del 20-may-2026.

Si Prisma sugiere `--force-reset` es porque el schema está en drift.
La solución correcta es:
    npx prisma migrate dev --name <descripcion>
EOF
        exit 1
    fi
done

# ─── 3. Parsear host y detectar prod por HOST EXPLÍCITO ────────────────
# Extrae lo que está entre '@' y la próxima '/' o '?'.
TARGET_HOST=$(printf '%s' "$DATABASE_URL" | sed -nE 's|^[^@]+@([^/?]+).*$|\1|p')
if [ -z "$TARGET_HOST" ]; then
    echo "❌ No pude extraer el host del DATABASE_URL."
    exit 1
fi

is_prod=false
if printf '%s' "$TARGET_HOST" | grep -q "$PROD_HOST_PATTERN"; then
    is_prod=true
fi

# ─── 4. ECHO obligatorio del host target ───────────────────────────────
echo "═══════════════════════════════════════════════════════════════"
echo "🎯 db push target"
echo "   host:  $TARGET_HOST"
echo "   prod?: $is_prod"
if [ "$DRY_RUN" = true ]; then
    echo "   mode:  DRY-RUN (no ejecuta prisma db push)"
fi
echo "═══════════════════════════════════════════════════════════════"

# ─── 5. Si es prod, exigir confirmación EXPLÍCITA ──────────────────────
if [ "$is_prod" = true ] && [ "${ALLOW_PROD_PUSH:-}" != "YES_EXPLICIT" ]; then
    cat <<EOF
🛑 BLOQUEADO — host es PRODUCCIÓN. Confirmación explícita requerida.

   Para correr db push contra prod:
       ALLOW_PROD_PUSH=YES_EXPLICIT npm run db:push

   Antes:
     1. Snapshot reciente en Neon.
     2. Confirma con el dueño del proyecto (Andrés).
     3. Considera migration formal: npx prisma migrate dev --name <desc>

   Si NO querías tocar prod: revisa qué le pasaste a DATABASE_URL.
EOF
    exit 1
fi

# ─── 6. Dry-run sale AQUÍ, antes de tocar el filesystem ────────────────
# El dry-run prueba la LÓGICA del guard (parse URL, detección de prod,
# validación de flag, ECHO). No debe mover .env ni ejecutar prisma —
# regla: dry-run no toca NADA, así puede correrse libremente para verificar.
if [ "$DRY_RUN" = true ]; then
    echo "✅ DRY-RUN OK — habría ejecutado: npx prisma db push ${ARGS[*]:-}"
    exit 0
fi

# ─── 7. Salvaguarda: .env.guard-bak pre-existente ──────────────────────
# Si un run previo del guard crasheó/fue interrumpido ANTES de restaurar
# .env, quedó un .env.guard-bak huérfano. Si ahora hacemos `mv .env .env.guard-bak`
# alegremente, CLOBBEAMOS ese backup con el .env actual → el .env original se
# pierde para siempre. ABORTAMOS y dejamos que el usuario investigue/restaure
# manualmente.
if [ -f ".env.guard-bak" ]; then
    cat <<'EOF'
🛑 BLOQUEADO — Existe ya `.env.guard-bak` de un run previo del guard.

   El guard interrumpido antes de restaurar. Si pisara ese backup con el
   `.env` actual, el `.env` original se perdería para siempre.

   Acción manual requerida:
     - Si NO existe `.env` actual: `.env.guard-bak` ES tu .env original.
         mv .env.guard-bak .env
     - Si existen AMBOS archivos: compáralos antes de decidir cuál conservar.
         diff .env .env.guard-bak

   Una vez resuelto, re-corre el guard.
EOF
    exit 1
fi

# ─── 8. Aislar Prisma del .env del repo (must-fix del 9-jun-2026) ──────
# Prisma carga `.env` AUTOMÁTICAMENTE desde el cwd al iniciar. Si lo dejamos
# en su lugar, puede sobrescribir DATABASE_URL/DIRECT_URL incluso después de
# haberlas exportado arriba. Por eso movemos `.env` temporalmente y el `trap`
# (que sobrevive porque NO usamos `exec`) lo restaura al exit/fallo/interrupción.
ENV_MOVED=false
if [ -f ".env" ]; then
    mv .env .env.guard-bak
    ENV_MOVED=true
    # Restaurar incluso si el script falla o se interrumpe.
    trap 'if [ "$ENV_MOVED" = true ] && [ -f ".env.guard-bak" ]; then mv .env.guard-bak .env; fi' EXIT INT TERM
fi

# ─── 9. Ejecutar prisma ────────────────────────────────────────────────
echo "✅ Guard pasado. Ejecutando: npx prisma db push ${ARGS[*]:-}"
# IMPORTANTE: NO usar `exec` aquí. Con `exec`, bash es reemplazado por npx y
# el trap NUNCA dispara → `.env.guard-bak` queda huérfano para siempre.
# Sin exec, npx corre como hijo, retorna, y el trap restaura `.env`.
npx prisma db push "${ARGS[@]:-}"
code=$?
exit $code
