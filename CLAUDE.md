# CLAUDE.md — Reglas Críticas del Proyecto Zéndity

Este archivo lo lee Claude Code automáticamente. Las reglas aquí son **NO NEGOCIABLES**.

---

## 🛑 BASE DE DATOS — REGLAS DE ORO

El 20-may-2026 se perdió toda la data de producción por un `prisma db push --force-reset` accidental.
Residentes, medicamentos, horarios, historial clínico — todo. No volvió.

### Prohibido absolutamente

1. **JAMÁS** correr `prisma db push --force-reset` por ningún motivo
2. **JAMÁS** correr `prisma migrate reset` (es destructivo)
3. **JAMÁS** correr `prisma db push` directamente sin pasar por el guard `npm run db:push`
4. **JAMÁS** correr `export $(cat .env ...) && npx prisma db push` — `.env` apunta a producción

### Si Prisma sugiere `--force-reset`

Significa que hay drift en el schema. Tu respuesta correcta es:

1. **PARAR**. No correr nada destructivo.
2. Reportar al usuario lo que Prisma sugiere y por qué.
3. Pedir autorización explícita antes de continuar.
4. Considerar `prisma migrate dev --name <descripcion>` como alternativa segura.

### Cambios de schema legítimos

```bash
npm run db:push              # corre el guard de seguridad
```

El guard bloquea `--force-reset` siempre, y exige `ALLOW_PROD_PUSH=1` si la URL apunta a Neon.

---

## 🔐 Variables de Entorno

- `.env` actualmente apunta directo a **producción** (Neon)
- Cualquier comando que cargue `.env` y toque DB → impacta producción
- Hasta que se separe en `.env.local` (dev) y `.env.production` (prod), tratar `.env` como **read-only de producción**

---

## ✅ Antes de Cualquier Commit

```bash
npx tsc --noEmit 2>&1 | head -10 && echo "TSC_EXIT:0"
```

Solo hacer commit si TSC_EXIT: 0 y sin errores en archivos de producción (tests e2e pueden ignorarse).

---

## 🎨 Identidad de Producto

- El nombre es **Zéndity** con acento en la É — en UI, emails, copy
- Paleta primaria: teal-600 (#0F6E56), teal-500 (#1D9E75)
- Trabajo siempre en español

---

## 🔧 Workflow de Git

- Commits descriptivos en español: `feat:`, `fix:`, `chore:`, `redesign:`, `perf:`
- Push directo a `main` salvo que el usuario pida lo contrario
- Nunca dejar trabajo en branches `claude/*` sin mergear

---

## 📋 Multi-tenant

- `hqId` **siempre** se obtiene de `session.user.headquartersId` en el servidor
- **Nunca** del body del request (vulnerabilidad)
- Toda query de datos debe filtrar por `headquartersId` del invoker

---

## 🚫 Anti-patrones Conocidos

1. **`ShiftSchedule`** es modelo viejo sin datos. Usar **`ScheduledShift`**.
2. **Hardcodear hqId** en código (ej. `b5d13d84-...`) — siempre resolver dinámicamente
3. **Datos mock en producción** — el commit `5739e8a` los eliminó. No reintroducir.
4. **Email remitente hardcoded** — usar siempre `process.env.SENDGRID_FROM_EMAIL`
5. **Plaintext PINs en email** — eliminado en commit `34ddc60`. No volver atrás.

---

## 🆘 Si Algo Sale Mal

1. **PARAR** inmediatamente. No intentar arreglar con más comandos.
2. Reportar al usuario exactamente qué pasó.
3. Esperar instrucción antes de cualquier acción correctiva.

La regla número uno es: **prefiero romper el ritmo que romper producción.**

---

## 🔎 Auditoría Proactiva — observa, no esperes a que pregunten

Eres el experto técnico. Andrés es el dueño del producto. Cuando leas
código o veas pantallas, tu trabajo NO es solo ejecutar lo que pidió —
es señalar lo que tú ves que él no ve todavía. Lecciones aprendidas:

### Cada vez que toques una ruta de UI o API, pregúntate en silencio:

1. **¿Quién puede entrar aquí?**
   ¿El rol mínimo requerido es el adecuado? ¿Un DIRECTOR de un cliente
   puede ver/tocar datos de OTRO cliente?

2. **¿Hay filtro por `headquartersId`?**
   Las queries `findMany` sin where de hqId son **fuga multi-tenant**
   automática. Reportar siempre. (Caso: `/api/corporate/headquarters` GET
   regresaba TODAS las sedes sin filtro hasta que Andrés lo notó.)

3. **¿Hay verificación de ownership en operaciones por ID?**
   `PATCH /resource/[id]` debe verificar que el invoker tenga acceso a
   ese `[id]` específico, no solo el rol.

4. **¿Esta función es operacional o comercial?**
   - Operacional (gestionar residentes, staff, horarios) → DIRECTOR/ADMIN
   - Comercial (crear sedes, cambiar plan, gestionar licencias) → SUPER_ADMIN
   - Si están mezcladas, separarlas.

5. **¿El cron / job / endpoint público está autenticado?**
   `/api/cron/*` debe verificar `CRON_SECRET`. Endpoints `force-dynamic`
   accesibles sin sesión son sospechosos.

6. **¿Los datos sensibles están enmascarados en logs?**
   PIN, passcode, contraseñas, tokens → nunca a console.log.

7. **¿Los emails/notificaciones tienen contenido PHI?**
   El cuerpo del email NO debe contener diagnósticos, medicamentos
   específicos, ni datos clínicos identificables. Sí puede decir
   "tienes una notificación, entra a app.zendity.com".

8. **¿Esta lista carga TODO o pagina?**
   `findMany` sin take en producción = OOM en cuanto crezcas. Default
   sano: `take: 50` con paginación.

### Cuando veas algo desalineado:

**Reportalo como observación, aunque no te lo hayan pedido.** Ejemplo:
> "Mientras buscaba X, noté que `/api/corporate/headquarters` no filtra
> por hqId. Cualquier DIRECTOR puede ver todas las sedes del sistema.
> ¿Quieres que lo arregle ahora o lo agrego al sprint?"

No esperes. No suavices. No asumas que él ya lo sabe. **Si no lo dices tú,
nadie lo dice.**

### Casos pasados — patrones a buscar
- Force-reset en producción (incidente 20-may-2026 — pérdida total)
- Multi-tenant leak en `/corporate/headquarters` (descubierto 21-may)
- 241 handovers sin firmar (deuda silenciosa)
- 3 redirects rotos a `/auth/signin` (404 masivos)
- `complianceScore` con bandas desalineadas (default 75 vs umbral CRITICAL <80)
- Cron expone fórmula 75 pero schema decía default 50 (drift)
- Planes 'BASIC'/'PROFESSIONAL' aceptados como string pero degradaban a LITE silenciosamente
- Botón "Nueva Sede" en `/corporate/sedes` crea sede huérfana sin Director

---

## 🗂️ Decisiones de infraestructura — log

### Neon Serverless Driver / `driverAdapters` (Fase 2 de conexiones) — **DIFERIDA**
*Decidido 07-jun-2026.*

- **Estado**: NO aplicar. `src/lib/prisma.ts` se mantiene con el cliente TCP estándar
  de Prisma 5.22 + pooler de Neon (`-pooler` en `DATABASE_URL`).
- **Por qué se evaluó**: cold starts en serverless + propuesta del cliente Prisma con
  `PrismaNeon` adapter sobre WebSocket (~80-150ms ganancia en cold start).
- **Por qué se descarta hoy**:
  1. En Prisma 5.22, `driverAdapters` está marcado **preview**, NO GA. El API del
     constructor de `@prisma/adapter-neon@5.22` es basado en `Pool` (no `{ connectionString }`
     como en v6.x GA). Riesgo de comportamiento sutil en runtime sobre 285 callers,
     en código HIPAA, no se compensa.
  2. **21 de 24 `$transaction` del repo son interactivas** (`async (tx) => …`), patrón
     con limitaciones conocidas en driver adapters Prisma 5.x. Específicamente: handovers
     (`care/shift/end`, `claim-coverage`), eMAR (`actions/emar`), UPP (`care/upp`),
     billing (`corporate/billing/*`), schedule builder (`hr/schedule/*`), kiosko externo,
     concierge, CRM. Cualquier regresión silenciosa rompe módulos clínicos en piloto.
  3. Fase 1 (pooling Neon, conexiones 84→32) **ya resolvió el problema operacional**.
     La Fase 2 es optimización de latencia, no bloqueador.
- **Condiciones para retomar**: upgrade a **Prisma 6.16+** (donde `driverAdapters` es GA,
  el API se limpia a `new PrismaNeon({ connectionString })`, y las transacciones
  interactivas son maduras sobre adapters). Pasos: branch dedicada, smoke test específico
  de los 6 callsites clínicos críticos (shift/end ×2, claim-coverage, upp, emar.actions ×2),
  comparar latencias en preview, decidir merge.
- **No es bloqueador del piloto**.
