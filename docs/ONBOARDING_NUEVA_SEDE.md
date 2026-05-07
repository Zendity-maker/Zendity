# Onboarding Nueva Sede — Zéndity
## Guía completa para el equipo de Zéndity

---

## PRE-REQUISITOS

- Contrato firmado con la sede
- Datos completos de la sede
- Lista de staff inicial
- Lista de residentes iniciales (si aplica)
- Email del director confirmado

---

## PASO 1 — Crear la sede en Neon (15 min)

**Datos necesarios:**
- Nombre oficial del hogar
- Dirección completa
- Teléfono
- Email institucional
- Capacidad (número de camas)
- Plan: Esencial / Profesional / Corporativo

**Query en Neon SQL Editor:**

```sql
INSERT INTO "Headquarters" (
  id, name, address, phone, email,
  capacity, "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'NOMBRE DEL HOGAR',
  'DIRECCIÓN COMPLETA',
  'TELÉFONO',
  'EMAIL',
  CAPACIDAD,
  NOW(), NOW()
);
```

> ⚠️ **Guardar el ID generado** — se necesita para todos los pasos siguientes.
> Obtenerlo con: `SELECT id FROM "Headquarters" WHERE name = 'NOMBRE DEL HOGAR';`

---

## PASO 2 — Crear usuario DIRECTOR (10 min)

```sql
INSERT INTO "User" (
  id, name, email, role,
  "pinCode", "headquartersId",
  "isActive", "isDeleted",
  "complianceScore",
  "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'NOMBRE DEL DIRECTOR',
  'EMAIL DEL DIRECTOR',
  'DIRECTOR',
  'PIN_6_DIGITOS',
  'HQ_ID_DEL_PASO_1',
  true, false, 100,
  NOW(), NOW()
);
```

> ⚠️ El PIN se guarda como texto plano temporalmente. Después del onboarding ejecutar `scripts/hash-pins.ts` para hashearlo con bcrypt.

**Enviar credenciales al director:**
- URL: app.zendity.com
- Email: [su email]
- PIN: [el PIN asignado]

---

## PASO 3 — Configurar colores (5 min)

Decidir con el director cuántos grupos de cuidadores necesita:

| Residentes | Colores recomendados |
|---|---|
| 1 – 15 | 2 colores: ROJO + AZUL |
| 16 – 25 | 3 colores: ROJO + AZUL + AMARILLO |
| 26 – 40 | 4 colores: ROJO + AZUL + AMARILLO + VERDE |

**Regla general:** 1 color por cada 8–10 residentes.

---

## PASO 4 — Crear staff inicial (20 min)

**Por cada empleado necesitas:**
- Nombre completo
- Email
- Rol: `CAREGIVER` / `NURSE` / `SUPERVISOR` / `KITCHEN` / `MAINTENANCE`
- PIN de 6 dígitos
- Color asignado (solo para cuidadores)

**Opción A — Interfaz:**
`app.zendity.com/hr/staff` → "Añadir empleado"

**Opción B — Carga masiva en Neon:**

```sql
INSERT INTO "User" (
  id, name, email, role,
  "pinCode", "headquartersId",
  "isActive", "isDeleted",
  "complianceScore",
  "createdAt", "updatedAt"
) VALUES
  (gen_random_uuid(), 'NOMBRE 1', 'EMAIL1', 'CAREGIVER', 'PIN001', 'HQ_ID', true, false, 100, NOW(), NOW()),
  (gen_random_uuid(), 'NOMBRE 2', 'EMAIL2', 'NURSE',     'PIN002', 'HQ_ID', true, false, 100, NOW(), NOW()),
  (gen_random_uuid(), 'NOMBRE 3', 'EMAIL3', 'SUPERVISOR','PIN003', 'HQ_ID', true, false, 100, NOW(), NOW());
```

---

## PASO 5 — Cargar residentes (30 min)

**Por cada residente necesitas:**
- Nombre completo
- Fecha de nacimiento
- Habitación
- Color de grupo (`RED` / `YELLOW` / `GREEN` / `BLUE`)
- Diagnósticos principales
- Medicamentos activos

**Opción A — Wizard de admisión:**
`app.zendity.com/corporate/patients/intake`

**Opción B — Carga masiva si hay más de 10 residentes:**
Usar la hoja Excel de template de carga masiva y coordinarlo con el equipo técnico de Zéndity.

---

## PASO 6 — Publicar primer horario (15 min)

1. Ve a `app.zendity.com/hr/schedule`
2. Crea los turnos de la semana actual
3. Asigna cuidadores a sus colores
4. Haz clic en **Publicar** → email automático al staff con su horario

---

## PASO 7 — Primer turno en el tablet (10 min)

1. La cuidadora abre `app.zendity.com/care` en el tablet del hogar
2. Login con sus credenciales
3. Selecciona su color de turno
4. Verifica que ve sus residentes asignados
5. Toma vitales de prueba de un residente

---

## PASO 8 — Activar familiares (20 min)

Por cada residente que lo requiera:

1. Abre la ficha del residente en `app.zendity.com/corporate/medical/patients/[id]`
2. Tab **"Familiar"**
3. Añade nombre + email del familiar encargado
4. El sistema genera un PIN automático de 6 dígitos
5. El familiar recibe un email con sus credenciales de acceso al portal

---

## PASO 9 — Verificación final (15 min)

Checklist antes de declarar la sede activa:

- [ ] Director puede hacer login en `app.zendity.com`
- [ ] Al menos 1 cuidador puede iniciar turno y ver residentes
- [ ] Los residentes aparecen correctamente en el tablet por color
- [ ] El supervisor ve el Mission Control (`/care/supervisor`)
- [ ] El Health Monitor está activo (automático — verificar en `/corporate/dashboard`)
- [ ] Al menos 1 familiar ha sido activado y puede ver el portal

---

## PASO 10 — Capacitación (1–2 horas)

**Materiales disponibles:**
- Manual del Cuidador (Word)
- Manual del Supervisor (Word)
- Video capacitación cuidador (Remotion)
- Academy en `app.zendity.com/academy`

**Sesión recomendada:**

| Sesión | Duración | Participantes |
|---|---|---|
| Sesión con el director | 30 min | Director + Zéndity |
| Sesión con el supervisor | 30 min | Supervisor + Zéndity |
| Sesión con cuidadores | 30 min | Todo el equipo de cuidado |
| Sesión con la enfermera | 15 min | Enfermera + Zéndity |

---

## TIEMPOS ESTIMADOS

| Paso | Tiempo | Quién |
|---|---|---|
| Crear sede en Neon | 15 min | Zéndity |
| Crear director | 10 min | Zéndity |
| Configurar colores | 5 min | Zéndity + Director |
| Crear staff | 20 min | Zéndity + Director |
| Cargar residentes | 30 min | Director + Enfermera |
| Publicar horario | 15 min | Supervisor |
| Primer turno | 10 min | Cuidador |
| Activar familiares | 20 min | Director |
| Verificación | 15 min | Zéndity |
| Capacitación | 90 min | Zéndity |
| **TOTAL** | **~3.5 horas** | |

---

## DATOS PARA SOLICITAR AL CLIENTE

Antes de comenzar el onboarding, enviar este formulario al director:

```
FORMULARIO DE ONBOARDING — ZÉNDITY
====================================

DATOS DE LA SEDE
Nombre oficial del hogar: ___________________________
Dirección completa:       ___________________________
Teléfono:                 ___________________________
Email institucional:      ___________________________
Capacidad (# de camas):   ___________________________
Plan contratado:          Esencial / Profesional / Corporativo

DIRECTOR
Nombre completo:  ___________________________
Email de acceso:  ___________________________
Teléfono celular: ___________________________

STAFF INICIAL (llenar una fila por empleado)
Nombre completo | Email | Rol | Color (cuidadores)
________________|_______|_____|__________________
________________|_______|_____|__________________
________________|_______|_____|__________________

RESIDENTES INICIALES (llenar una fila por residente)
Nombre completo | Fecha Nac. | Habitación | Color | Diagnóstico principal
________________|____________|____________|_______|______________________
________________|____________|____________|_______|______________________
________________|____________|____________|_______|______________________

FAMILIARES A ACTIVAR (opcional en onboarding inicial)
Nombre familiar | Email | Residente que representa
________________|_______|_________________________
________________|_______|_________________________

PREFERENCIAS
¿Cuántos grupos de color necesita? 2 / 3 / 4
¿Turnos estándar (8h) o turnos largos (12h)?  8h / 12h / Mixtos
¿Requiere portal familiar desde el día 1?      Sí / No
```

---

## NOTAS TÉCNICAS (equipo Zéndity)

### IDs de sedes en producción

| Sede | HQ ID |
|---|---|
| Vivid Senior Living Cupey | `b5d13d84-0a57-42fe-a1ed-bff887ed0c09` |
| Sandbox / Staging | `b2ac0700-f937-4085-9595-dcf81a2e5e30` |

### Post-onboarding — migración bcrypt

Después de crear los usuarios con PIN en texto plano, ejecutar:

```bash
export $(cat .env.local | grep -v '^#' | xargs) && npx ts-node scripts/hash-pins.ts
```

Verificar output y confirmar que todos los PINs quedaron hasheados antes de enviar las credenciales.

### Variables de entorno requeridas en Vercel

Confirmar que estas variables están activas para la sede nueva (todas son globales, aplican a todas las sedes):

- `DATABASE_URL` — Neon connection pooler
- `DIRECT_URL` — Neon direct connection (para Prisma migrate)
- `NEXTAUTH_SECRET` — clave JWT
- `NEXTAUTH_URL` — `https://app.zendity.com`
- `SENDGRID_API_KEY` — para emails de bienvenida y horario
- `SENDGRID_FROM_EMAIL` — remitente verificado en SendGrid
- `OPENAI_API_KEY` — para Zendi AI (resumen de turno, PAI)
- `CRON_SECRET` — autorización de los cron jobs
