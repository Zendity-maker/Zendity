# Scripts archivados (.ts.bak)

Estos cuatro apuntan a una arquitectura que ya no existe y **rompían
`npx next build`**, porque Next type-checkea todo `**/*.ts` del proyecto.

- `backfill-patient-floor.ts.bak`
- `seed-multi-floor-smoke.ts.bak`
- `test-floor-helpers.ts.bak`
- `verify-multi-floor.ts.bak`

## Qué pasó

Asumen dos cosas que se descartaron:

1. **`Patient.floor` como columna.** Hoy el piso no se guarda: se **deriva**
   del `colorGroup` del residente contra el `colorFloorMap` de la sede
   (`src/lib/floor-map.ts`). Un backfill de una columna que no existe no
   tiene nada que hacer.
2. **`src/lib/floor.ts` como módulo.** Se llama `floor-map.ts`.

Sus reemplazos ya existen, versionados y compilando limpio:
`scripts/smoke-floor-map-unit.ts` y `scripts/smoke-floor-map-e2e.ts`.

## Por qué .bak y no borrados

Estaban en `.gitignore`, así que **nunca se commitearon**: no hay copia en
git de la que recuperarlos. Renombrarlos saca su contenido del type-check
sin destruirlo. Bórralos cuando estés seguro de que no queda nada
aprovechable dentro.

Archivados el 21-ago-2026.
