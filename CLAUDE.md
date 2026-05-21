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
