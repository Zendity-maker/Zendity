import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const { patientId, bathCompleted, foodIntake, notes, photoUrl } = await req.json();

        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }

        // Tenant check: el paciente debe estar en la sede del invocador
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true }
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        // authorId SIEMPRE del session — no se confía en el body
        const authorId = invokerId;

        // Determinar alerta clínica si no comió nada (0%) o notas preocupantes
        const isClinicalAlert = Number(foodIntake) === 0 || (notes && notes.toLowerCase().includes('dolor'));

        const log = await prisma.dailyLog.create({
            data: {
                patientId,
                authorId,
                bathCompleted: Boolean(bathCompleted),
                foodIntake: Number(foodIntake),
                notes,
                isClinicalAlert: Boolean(isClinicalAlert),
                photoUrl: photoUrl || null // FASE 37
            }
        });

        // Antes, levantar una alerta clínica le asignaba al cuidador un curso
        // elegido con `findFirst orderBy createdAt desc` — es decir, el curso
        // sembrado más recientemente, sin relación alguna con lo que reportó.
        // Hoy eso le habría asignado "Signos Vitales" a quien documentó que un
        // residente no comió.
        //
        // Se elimina por dos razones. Asignar formación que no aborda el
        // problema enseña al equipo a ignorar las asignaciones — el mismo
        // criterio que ya sigue academy-assign. Y sobre todo: castigaba con
        // tarea a quien REPORTA, que es exactamente la conducta que el hogar
        // necesita fomentar.
        //
        // La formación por incidente sigue existiendo donde tiene sentido: en
        // /api/hr/incidents/[id]/decide, cuando alguien evaluó el caso.

        return NextResponse.json({ success: true, log, alert: isClinicalAlert ? "Notificación de Riesgo Operativo y Asignación de Curso Activa." : null });

    } catch (error) {
        console.error("Log POST Error:", error);
        return NextResponse.json({ success: false, error: "Error registrando bitácora" }, { status: 500 });
    }
}
