#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# `npm run dev` CONTRA PRODUCCIÓN, PERO SABIÉNDOLO
#
# ═══ QUÉ SE ENCONTRÓ EL 27-SEP-2026 ═══
#
# `npm run dev` llevaba tiempo sin poder conectar. El error era éste:
#
#     Authentication failed against database server at
#     `ep-wispy-queen-ae20881h.c-2.us-east-2.aws.neon.tech`
#
# Dos cosas a la vez, y la segunda es la importante:
#
#   1. `.env.local` gana sobre `.env` en Next.js, y su `DATABASE_URL` llevaba
#      una contraseña caducada. Por eso no conectaba.
#   2. Esa URL apunta al host de PRODUCCIÓN, y encima al directo, sin pooler.
#      O sea que el día que esa contraseña se arreglara —arreglo de una línea,
#      de los que se hacen sin pensar— `npm run dev` habría estado escribiendo
#      en la base de la que vive el hogar sin que nada lo dijera.
#
# La contraseña caducada estaba tapando el problema de verdad. Arreglarla a
# secas habría sido quitar el aviso y dejar el fallo.
#
# ═══ QUÉ HACE ESTO ═══
#
# Resuelve el `DATABASE_URL` igual que lo resuelve Next.js —`.env.local` por
# encima de `.env`, y el entorno del shell por encima de los dos—, dice EN ALTO
# a qué host va a hablar la app, y si ese host es producción no arranca a menos
# que se diga explícitamente:
#
#     DEV_CONTRA_PROD=SI npm run dev
#
# o dejando `DEV_CONTRA_PROD=SI` en `.env.local`, que es lo razonable mientras
# no haya una base de desarrollo.
#
# No bloquea trabajo: hoy no hay otra base a la que apuntar. Lo que hace es que
# apuntar a producción sea una frase que alguien escribió, y no el valor por
# omisión de un fichero que nadie mira.
#
# ═══ LA SALIDA DE VERDAD ═══
#
# Una rama de Neon. Tiene otro endpoint, así que no casa con el patrón de
# producción y este guard la deja pasar sin decir nada — igual que `db:push`.
# Mientras no exista, esto es lo que hay.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/host-produccion.sh
source "$RAIZ/scripts/lib/host-produccion.sh"

# ─── Resolver DATABASE_URL con la MISMA precedencia que Next.js ──────────────
# El entorno del shell gana sobre todo; después .env.local; después .env.
# (Next.js carga también .env.development y .env.development.local; aquí no
# existen. Si algún día existen, hay que añadirlos a esta lista.)
# leer_var_de <fichero> <NOMBRE>  →  imprime el valor, o falla si no está.
# Se salta las lineas comentadas, que es justo lo que hace dotenv.
leer_var_de() {
    [ -f "$1" ] || return 1
    local v
    v="$(grep -E "^[[:space:]]*$2=" "$1" | tail -1 | sed -E "s/^[[:space:]]*$2=//; s/^\"//; s/\"$//; s/^'//; s/'$//")" || return 1
    [ -n "$v" ] || return 1
    printf '%s' "$v"
}

# El orden que mira Next.js, de más fuerte a más débil.
FICHEROS_ENV=(.env.development.local .env.local .env.development .env)

# buscar_var <NOMBRE>  →  imprime "valor\tde dónde salió".
buscar_var() {
    local f v
    for f in "${FICHEROS_ENV[@]}"; do
        if v="$(leer_var_de "$RAIZ/$f" "$1")"; then printf '%s\t%s' "$v" "$f"; return 0; fi
    done
    return 1
}

ORIGEN=''
URL="${DATABASE_URL:-}"
if [ -n "$URL" ]; then
    ORIGEN='la variable del shell'
else
    if PAR="$(buscar_var DATABASE_URL)"; then
        URL="${PAR%%$'\t'*}"
        ORIGEN="${PAR##*$'\t'}"
    fi
fi

# La confirmación puede venir del shell O de un fichero .env — que es donde
# tiene sentido dejarla mientras no haya base de desarrollo. Si el guard solo
# mirara el entorno, el mensaje de abajo estaría prometiendo algo que no hace.
CONFIRMA="${DEV_CONTRA_PROD:-}"
if [ -z "$CONFIRMA" ] && PAR2="$(buscar_var DEV_CONTRA_PROD)"; then
    CONFIRMA="${PAR2%%$'\t'*}"
fi

if [ -z "${URL:-}" ]; then
    echo "⚠️  No hay DATABASE_URL en ningún sitio. La app va a arrancar sin base."
    exec npx next dev -H 0.0.0.0 "$@"
fi

HOST="$(host_de_url "$URL")"

echo ""
echo "  ┌─────────────────────────────────────────────────────────────"
echo "  │ La app va a hablar con:  $HOST"
echo "  │ DATABASE_URL sale de:    $ORIGEN"
echo "  └─────────────────────────────────────────────────────────────"

if es_host_de_produccion "$HOST"; then
    if [ "$CONFIRMA" != "SI" ]; then
        echo ""
        echo "  🛑  ESO ES PRODUCCIÓN."
        echo ""
        echo "      Es la base de la que viven Cupey y Mayagüez. Lo que registres"
        echo "      probando —una dosis, una caída, un residente— queda escrito en"
        echo "      el expediente de alguien."
        echo ""
        echo "      Si aun así es lo que quieres:"
        echo ""
        echo "          DEV_CONTRA_PROD=SI npm run dev"
        echo ""
        echo "      o deja DEV_CONTRA_PROD=SI en .env.local y no vuelve a preguntar."
        echo ""
        exit 1
    fi
    echo "  ⚠️  Contra PRODUCCIÓN, con DEV_CONTRA_PROD=SI puesto. Cuidado con lo que registras."
fi

echo ""
exec npx next dev -H 0.0.0.0 "$@"
