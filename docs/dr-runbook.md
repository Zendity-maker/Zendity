# 🚨 Disaster Recovery Runbook — Zéndity

**Última actualización:** 22-may-2026
**Owner:** Andrés Flores (andrestyflores@gmail.com)
**Tiempos objetivo:**
- **RTO** (Recovery Time Objective) — restauración completa en **≤ 1 hora**
- **RPO** (Recovery Point Objective) — máxima pérdida aceptable **≤ 24 horas**

---

## 📋 ¿Cuándo usar este runbook?

Activar el procedimiento si ocurre **cualquiera** de:

1. **Pérdida total de data** — la DB de producción está vacía o corrupta
2. **Pérdida parcial** — una tabla crítica fue truncada o borrada
3. **Cliente reporta** — un director ve que sus residentes/staff desaparecieron
4. **Force-reset accidental** — un `prisma db push --force-reset` u operación equivalente
5. **Migration que rompió** — un cambio de schema corrompió data existente
6. **Caída prolongada de Neon** — > 30 min sin que Neon responda

⚠️ **NO uses este runbook para:**
- Errores de aplicación (404, 500) — son problemas de código
- Lentitud — escalar el plan de Neon
- Bugs de UI — fixes normales

---

## 🎯 Árbol de decisión rápido

```
¿Qué pasó?
│
├── Data perdida hace < 2 días?
│   └── ✅ NEON PITR (Plan A) — más rápido, sin descarga
│
├── Data perdida hace > 2 días pero < 30 días?
│   └── ✅ R2 BACKUP (Plan B) — restaura del archivo diario
│
└── Data perdida hace > 30 días?
    └── ⚠️ NO HAY RECUPERACIÓN POSIBLE — escalada a Neon support
```

---

## Plan A — Neon Point-in-Time Recovery (preferido)

**Pre-requisitos:**
- Acceso al [Neon Console](https://console.neon.tech)
- Cuenta: `andrestyflores@gmail.com`
- Project: `Zendity` en AWS US East 2 (Ohio)
- History retention configurado: **2 días**

### Pasos

1. **Identifica el timestamp objetivo** — la hora EXACTA antes del incidente
   - Ej: "Hoy a las 14:00 todo estaba bien, a las 14:23 explotó" → target = 14:10

2. **Entra a Neon Console** → proyecto Zéndity (Ohio)

3. **Menú lateral → "Backup & Restore"** (o "Branches")

4. **Sección "Restore from history":**
   - Source branch: `main`
   - Point in time: selecciona timestamp del paso 1
   - Click **"Preview data"** (verifica que el preview muestre data correcta)

5. **Si el preview se ve bien:** click **"Restore"**
   - Confirma cuando pregunte
   - Espera 1-3 minutos

6. **Verifica desde la app:**
   ```bash
   curl https://app.zendity.com/api/health
   ```
   Y entra como `andrestyflores@gmail.com` / PIN `1234` para confirmar visualmente.

7. **Comunica a clientes** si hubo downtime > 5 min (ver sección "Comunicación" abajo)

### Tiempo esperado: **5-15 minutos**

---

## Plan B — Restauración desde R2 Backup

**Pre-requisitos locales:**
- `aws` CLI instalado (`brew install awscli`)
- `psql` v17 instalado (`brew install libpq && brew link --force libpq`)
- Archivo `.env.r2` en raíz del proyecto con credenciales R2:
  ```
  R2_ACCOUNT_ID=xxx
  R2_ACCESS_KEY_ID=xxx
  R2_SECRET_ACCESS_KEY=xxx
  R2_BUCKET=zendity-backups
  ```

### Pasos

1. **Lista backups disponibles:**
   ```bash
   ./scripts/dr-restore.sh list
   ```
   Verás todos los `zendity-prod-YYYY-MM-DD_*.sql.gz`. Elige el más cercano ANTES del incidente.

2. **Crea una branch de prueba en Neon** (NUNCA restaures directo a prod sin ensayo):
   - Console Neon → tu proyecto → Branches → "New branch"
   - Nombre: `dr-test-YYYY-MM-DD`
   - Copia su CONNECTION STRING (similar a `postgresql://user:pass@ep-test...neon.tech/neondb`)

3. **Restaura el backup a la branch de prueba:**
   ```bash
   ./scripts/dr-restore.sh restore \
     zendity-prod-2026-05-22_07-00-00-daily.sql.gz \
     "postgresql://...connection-string-de-test..."
   ```

4. **Valida la branch de prueba:**
   ```bash
   psql "<branch-test-url>" -c 'SELECT COUNT(*) FROM "User";'
   psql "<branch-test-url>" -c 'SELECT COUNT(*) FROM "Patient";'
   psql "<branch-test-url>" -c 'SELECT COUNT(*) FROM "Headquarters";'
   ```
   Si los conteos se ven razonables → procede al paso 5.

5. **Promueve la branch a primary** (Neon Console):
   - Branches → branch `dr-test-...` → menú "..." → "Set as primary"
   - Confirma. La branch ahora es la DB de producción.

6. **Actualiza Vercel env vars si la branch nueva cambió de endpoint:**
   - Si el endpoint cambió, actualizar `DATABASE_URL` y `DIRECT_URL` en Vercel
   - Redeploy

7. **Verifica producción:**
   ```bash
   curl https://app.zendity.com/api/health
   ```

8. **Comunica.**

### Tiempo esperado: **20-45 minutos**

### 🚨 Restore DIRECTO a producción (último recurso)

Si por algún motivo NO puedes crear una branch de prueba primero:
```bash
ALLOW_PROD_RESTORE=1 ./scripts/dr-restore.sh restore \
  <filename> \
  "$DATABASE_URL_DE_PRODUCCION"
```
El script pedirá que escribas literalmente `RESTAURAR PRODUCCION` para confirmar.

**SOLO usar si:** la DB de prod está completamente vacía/inaccesible y Plan A no es opción.

---

## 📞 Escalada

| Tiempo desde incidente | Acción |
|------------------------|--------|
| 0-15 min | Andrés ejecuta Plan A |
| 15-30 min | Si Plan A no funcionó, escalada a Plan B |
| 30-45 min | Si Plan B falla, contactar Neon Support |
| 45-60 min | Notificar a clientes piloto (ver template abajo) |
| 60+ min | Considerar fallback a operación papel temporal |

### Contactos

- **Neon Support:** support@neon.tech (incluir project ID `ep-wispy-queen-ae20881h`)
- **Vercel Support:** vercel.com/help (Pro/Enterprise plan tiene SLA)
- **SendGrid:** support.sendgrid.com (para emails de notificación)

---

## 📨 Template de comunicación a clientes

### Email durante el incidente (T+30 min)

```
Asunto: Notificación de servicio — Zéndity

Hola [Director],

Detectamos un incidente técnico que está afectando temporalmente
el acceso a Zéndity. Nuestro equipo está trabajando para restaurar
el servicio en este momento.

Tiempo estimado de resolución: < 1 hora.

Tu data está protegida — tenemos copias de seguridad automáticas
y estamos restaurando desde la última copia.

Te notificaremos en cuanto el servicio esté restaurado.

Por cualquier urgencia clínica, opera en papel temporalmente
y luego digitalizaremos el catch-up.

Andrés Flores
Zéndity Corp
WhatsApp: [número]
```

### Email post-incidente (T+24h)

```
Asunto: Resumen del incidente del [fecha]

Hola [Director],

Resumen del incidente:

QUÉ PASÓ:
[descripción técnica simple]

CUÁNDO:
- Inicio: [hora]
- Detección: [hora]
- Resolución: [hora]
- Duración: X minutos

IMPACTO EN TU SEDE:
- [Lista específica de qué se afectó]
- Data: [restaurada al 100% / con pérdida de X horas / ...]

PREVENCIÓN:
[Qué hicimos para que no vuelva a pasar]

COMPENSACIÓN:
[Si aplica — crédito en la próxima factura]

Andrés Flores
```

---

## 🧪 Test trimestral del runbook

**Cada 3 meses**, el primer lunes a las 8am, ejecutar este simulacro:

1. Crea una branch de prueba en Neon (no toques prod)
2. Ejecuta `./scripts/dr-restore.sh list` y elige el backup de ayer
3. Restaura a la branch de prueba
4. Verifica con queries de conteo
5. Documenta el tiempo total y cualquier issue
6. Update este runbook si encontraste algo

**Próximo test:** 22-ago-2026

---

## 📝 Historial de incidentes

| Fecha | Tipo | Duración | Recuperación | Owner |
|-------|------|----------|--------------|-------|
| 20-may-2026 | Force-reset accidental | 24h+ | Manual (seeds) — sin backup automático | Andrés (con asistencia IA) |

---

## 🔐 Credenciales y secretos

**NO escribir credenciales en este documento.** Las credenciales están en:

- **Neon Console:** Login con `andrestyflores@gmail.com`
- **Vercel env vars:** `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `SENDGRID_API_KEY`
- **GitHub Secrets:** `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- **Local .env.r2:** mismo set de R2_*

Si necesitas rotar credenciales, hazlo desde cada panel respectivo.

---

## 🔗 Links útiles

- **Neon Console:** https://console.neon.tech
- **Vercel Dashboard:** https://vercel.com/zendity-makers-projects/zendity
- **Cloudflare R2:** https://dash.cloudflare.com → R2
- **GitHub Actions:** https://github.com/Zendity-maker/Zendity/actions
- **Status page:** [TODO — crear en Sprint 1 día 5]
