---
name: zendity-context
description: >
  Use this skill at the START of every coding session for the Zendity project.
  Trigger whenever the user mentions Zendity, app.zendity.com, Claude Code + Zendity,
  or any Zendity module (eMAR, Schedule Builder, Academy, portal familiar, kiosco,
  dashboard supervisor, etc.). Read this BEFORE writing any code, creating any files,
  or running any commands. This skill contains the complete project context, stack,
  patterns, and conventions that must be followed at all times.
---

# Zendity — Contexto Completo del Proyecto

## Identidad del Proyecto

- **Nombre**: Zéndity (con acento en la É) — Healthcare Management Platform
- **URL producción**: app.zendity.com
- **Repo**: github.com/Zendity-maker/Zendity
- **Fundador**: Andrés Flores (andrestyflores@gmail.com)
- **Idioma de trabajo**: Español. Todos los commits, comentarios y respuestas en español.

## Stack Tecnológico

Frontend:  Next.js 14+ (App Router), TypeScript, Tailwind CSS
Backend:   Next.js API Routes (src/app/api/)
ORM:       Prisma
DB:        Neon PostgreSQL (serverless)
Auth:      NextAuth.js — strategy: "jwt", roles via enum Role
Deploy:    Vercel (producción en app.zendity.com)
Email:     SendGrid (SENDGRID_API_KEY + SENDGRID_FROM_EMAIL en env)
AI:        OpenAI + Gemini via API routes

## Credenciales de Referencia

Usuario producción: andrestyflores@gmail.com / PIN: 1234
Rol: DIRECTOR
Sede activa: Vivid Senior Living Cupey
HQ ID producción: b5d13d84-0a57-42fe-a1ed-bff887ed0c09
HQ ID sandbox:    b2ac0700-f937-4085-9595-dcf81a2e5e30

## Estructura de Directorios Clave

src/
├── app/
│   ├── api/           # API routes
│   │   ├── auth/      # NextAuth
│   │   ├── care/      # Módulos clínicos
│   │   ├── corporate/ # Módulos corporativos
│   │   ├── hr/        # RRHH y Schedule Builder
│   │   └── family/    # Portal familiar
│   ├── care/          # UI cuidadores y supervisor
│   ├── corporate/     # UI directivo y admin
│   ├── hr/            # UI RRHH
│   ├── family/        # Portal familiar
│   ├── reception/     # Kiosco de recepción (en desarrollo)
│   └── academy/       # Cursos y certificaciones
├── components/        # Componentes reutilizables
├── lib/
│   ├── prisma.ts      # Cliente Prisma singleton
│   └── auth.ts        # Configuración NextAuth
└── types/
    └── care.ts        # Tipos TypeScript del módulo de cuidado

## Roles del Sistema

DIRECTOR, ADMIN, SUPERVISOR, CAREGIVER, NURSE, KITCHEN, MAINTENANCE, FAMILY

## Patrón Estándar de API Route

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hqId = session.user.headquartersId;
    const body = await req.json();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Error procesando' }, { status: 500 });
  }
}

## Modelos Prisma Clave — Schedule Builder

Schedule: id, headquartersId, weekStartDate, status(DRAFT/PUBLISHED), publishedAt, createdByUserId
ScheduledShift: id, scheduleId, userId, date, shiftType(MORNING/EVENING/NIGHT), colorGroup, isAbsent, absentMarkedAt, absentMarkedById
ShiftColorAssignment: id, headquartersId, scheduledShiftId, color, userId, assignedBy, isAutoAssigned, assignedAt
Notification: id, userId, type, title, message, isRead, createdAt

## Modelos Prisma Clave — Portal Familiar

FamilyMember: id, headquartersId, patientId, name, email@unique, passcode, accessLevel, inviteToken@unique, inviteExpiry, isRegistered

## APIs Schedule Builder

/api/hr/schedule          GET/POST  — cargar/crear horario
/api/hr/schedule/publish  POST      — publicar + email al equipo
/api/hr/schedule/unpublish POST     — revertir a DRAFT
/api/hr/schedule/absent   POST      — marcar empleado ausente
/api/hr/schedule/redistribute POST — asignar color a cuidador
/api/hr/schedule/my-color GET       — color del roster activo

## APIs Portal Familiar

/api/corporate/family/invite  POST — enviar invitación con token
/api/family/verify-token      GET  — verificar token
/api/family/activate          POST — activar acceso con PIN

## Flujo de Invitación Familiar

Email → /family-invite.html?token= (HTML puro, sin Next.js)
  → limpia cookies JS → redirige a /family/register?token=
  → familiar crea PIN → passcode guardado → signIn → /family

## Git Workflow — CRÍTICO

SIEMPRE push directo a main. Nunca dejar trabajo en branch claude/
git add [archivos]
git commit -m "tipo: descripción en español"
git push origin main
git log --oneline -1

Antes de cada commit:
npx tsc --noEmit 2>&1 | head -10 && echo "TSC_EXIT:0"
Solo hacer commit si TSC_EXIT: 0

DB Push a producción:
export $(cat .env | grep -v '^#' | xargs) && npx prisma db push 2>&1 | tail -5

## Paleta de Colores Tailwind

slate-900  → fondo principal oscuro
teal-600   → #0F6E56 — color primario Zéndity
teal-500   → #1D9E75 — color secundario
teal-100   → #E1F5EE — fondos claros
red-500    → ausencias, alertas críticas
amber-500  → advertencias, estados pendientes

## Estado de Módulos en Producción

eMAR Digital        ✅ /care
Cierre de Turno     ✅ /care
Dashboard Supervisor ✅ /care/supervisor
Schedule Builder    ✅ /hr/schedule
Motor de Ausencias  ✅ /hr/schedule + /care/supervisor
Academy             ✅ /academy
Portal Familiar     ✅ /family
Kiosco Recepción    🔨 /reception (en desarrollo)

## Reglas Críticas

1. NUNCA usar ShiftSchedule — modelo viejo sin datos. Usar ScheduledShift.
2. Email SIEMPRE usa process.env.SENDGRID_FROM_EMAIL — nunca hardcodear remitente.
3. hqId SIEMPRE de session.user.headquartersId en el servidor.
4. TSC limpio antes de todo commit.
5. Zéndity lleva acento en la É — en todos los textos, emails y UI.
6. Merge a main inmediatamente — nunca dejar trabajo en branch claude/.

## Variables de Entorno Críticas en Vercel

DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL,
SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, OPENAI_API_KEY, GEMINI_API_KEY
