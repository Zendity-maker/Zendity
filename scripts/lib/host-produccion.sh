#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CUÁL ES EL HOST DE PRODUCCIÓN. UNA SOLA DEFINICIÓN.
#
# Esta cadena estaba escrita DOS veces —db-push-guard.sh:40 y
# db-migrate-guard.sh:86— y es la que decide si un comando toca la base de la
# que vive el hogar. Dos copias de la regla que protege producción es
# exactamente la forma de equivocarse que se repitió cuatro veces en
# septiembre: se cambia una y la otra se queda como estaba, callada.
#
# El endpoint de Neon es lo único estable entre las dos formas de la URL:
#
#     ep-wispy-queen-ae20881h.c-2.us-east-2.aws.neon.tech          (directa)
#     ep-wispy-queen-ae20881h-pooler.c-2.us-east-2.aws.neon.tech   (pooler)
#
# Una rama de Neon tiene OTRO endpoint, así que no casa con este patrón — que
# es justo lo que se quiere: una rama es segura y no debe pedir permiso.
# ─────────────────────────────────────────────────────────────────────────────

PROD_HOST_PATTERN='ep-wispy-queen-ae20881h'

# es_host_de_produccion <host>  →  0 si es producción, 1 si no.
es_host_de_produccion() {
    case "$1" in
        *"$PROD_HOST_PATTERN"*) return 0 ;;
        *) return 1 ;;
    esac
}

# host_de_url <postgres://...>  →  imprime solo el host, sin usuario ni clave.
host_de_url() {
    printf '%s' "$1" | sed -E 's|^[a-z+]+://||; s|^[^@]*@||; s|[/?].*$||; s|:[0-9]+$||'
}
