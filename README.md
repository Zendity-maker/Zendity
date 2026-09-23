# Zéndity

Plataforma de gestión clínica y operativa para hogares de adultos mayores.
En producción en **[app.zendity.com](https://app.zendity.com)**, con dos sedes vivas:
Vivid Senior Living **Cupey** y **Mayagüez**, en Puerto Rico.

No es un piloto. Hay residentes reales, medicamentos reales y turnos reales
detrás de cada pantalla, y el expediente que genera es clínico. Eso condiciona
todo lo que sigue.

---

## Antes de tocar nada

**Lee [`CLAUDE.md`](./CLAUDE.md).** No es opcional y no es documentación de
cortesía: recoge las reglas que costaron un incidente cada una. Las tres que
más rápido hacen daño:

1. **`.env` apunta a PRODUCCIÓN.** Cualquier comando que lo cargue y toque la
   base impacta a los dos hogares. Trátalo como solo-lectura de producción.
2. **Nunca `prisma db push --force-reset` ni `prisma migrate reset`.** El
   20-may-2026 se perdió toda la data de producción por un force-reset
   accidental: residentes, medicamentos, horarios, historial clínico. No volvió.
3. **Los cambios de esquema van por los guards**, nunca por Prisma a pelo:

   ```bash
   npm run db:push      # scripts/db-push-guard.sh
   npm run db:migrate   # scripts/db-migrate-guard.sh — usa `migrate deploy` contra prod
   ```

   Los dos hacen ECHO del host destino antes de ejecutar. Si ves un host que no
   esperas, aborta.

Y antes de cada commit:

```bash
npx tsc --noEmit
```

---

## El stack, medido contra `package.json`

| | |
|---|---|
| Framework | **Next.js 16.1.6** (App Router) · React 19.2.3 |
| Base de datos | PostgreSQL en **Neon** (serverless, con pooler) |
| ORM | **Prisma 5.22** — cliente TCP estándar, sin driver adapters (ver el log de decisiones en `CLAUDE.md`) |
| Auth | **NextAuth 4** — estrategia JWT, sin adapter. Login por email + PIN |
| Estilos | **Tailwind 4** sobre un sistema de componentes propio en `src/components/ui` |
| Correo | **SendGrid** — el remitente sale siempre de `SENDGRID_FROM_EMAIL` |
| IA | OpenAI y Google Gemini, por ruta |
| Tests | Vitest (unidad) · Playwright (e2e, en `tests/e2e`) |
| Despliegue | Vercel, auto-deploy desde `main`. Crons en `vercel.json` |

---

## Por dónde entra cada quien

El sistema tiene **17 roles** (`enum Role` en `prisma/schema.prisma`) y cada
superficie está pensada para un oficio concreto, no para «un usuario».

| superficie | quién | qué hace ahí |
|---|---|---|
| `/care` | cuidadoras | la tableta del piso: medicamentos, vitales, comidas, baños, rotación, bitácora y cierre de turno |
| `/care/supervisor` | supervisión | Mission Control: quién está en piso, qué falta, qué se quedó sin cerrar |
| `/corporate` | dirección y admin | residentes, expedientes, facturación, personal, informes |
| `/hr` | recursos humanos | horarios, asistencia, observaciones, evaluaciones, formación |
| `/academy` | todo el personal | cursos y certificaciones |
| `/family` | familiares | estado del residente, mensajes, citas, facturas, concierge |
| `/med` · `/kitchen` · `/maintenance` · `/cleaning` | oficios | recetas, menús, avisos, zonas |
| `/reception` · `/external-kiosk` | recepción | visitas y servicios externos |

---

## Arrancar en local

```bash
npm install
npm run dev
```

Necesitas un `.env` con al menos `DATABASE_URL`, `DIRECT_URL`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL` y `SENDGRID_API_KEY`.
**Apunta a una branch de Neon, no a producción.**

```bash
npm run test        # vitest
npm run test:e2e    # playwright
npm run db:studio   # prisma studio
```

---

## Dos reglas de arquitectura que no se negocian

**Multi-tenant.** `hqId` sale **siempre** de `session.user.headquartersId` en el
servidor, nunca del cuerpo del request, y toda consulta de datos filtra por la
sede de quien invoca. Un `findMany` sin ese filtro es una fuga entre clientes.

**PHI.** El cuerpo de un correo o de una notificación no lleva diagnósticos,
medicamentos ni datos clínicos identificables. Puede decir que hay algo que ver
y enlazar a la app; el dato vive detrás de la sesión.

---

## Dónde está lo demás

- **[`CLAUDE.md`](./CLAUDE.md)** — reglas críticas, antipatrones conocidos y el
  log de decisiones de infraestructura. Es el documento que de verdad se
  mantiene al día.
- **`prisma/schema.prisma`** — la fuente de verdad del modelo de datos.
- **`scripts/`** — utilidades de operación, casi todas fuera de git a propósito.
- **`src/lib/`** — la lógica compartida, y donde vive el *por qué* de casi
  todas las decisiones: cada fichero lleva en su cabecera la medición que lo
  justifica.
