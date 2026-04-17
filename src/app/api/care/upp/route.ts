import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['NURSE', 'DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const READ_ROLES = ['NURSE', 'DIRECTOR', 'ADMIN', 'SUPERVISOR', 'CAREGIVER'];

/**
 * GET /api/care/upp?hqId=X         → todas las úlceras ACTIVE+HEALING de la sede
 * GET /api/care/upp?patientId=Y    → úlceras de un residente específico
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        if (!READ_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Prohibido' }, { status: 403 });
        }

        const invokerHqId = (session.user as any).headquartersId;
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId');
        const patientId = searchParams.get('patientId');

        // Forzar tenant del invocador
        const effectiveHqId = invokerHqId;

        if (patientId) {
            // Validar paciente en sede
            const patient = await prisma.patient.findFirst({
                where: { id: patientId, headquartersId: effectiveHqId },
                select: { id: true, name: true },
            });
            if (!patient) return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });

            const ulcers = await prisma.pressureUlcer.findMany({
                where: { patientId },
                include: {
                    logs: {
                        include: { nurse: { select: { name: true, role: true } } },
                        orderBy: { createdAt: 'desc' },
                    },
                },
                orderBy: [{ status: 'asc' }, { identifiedAt: 'desc' }],
            });
            return NextResponse.json({ success: true, ulcers });
        }

        // Lista por sede — active + healing
        if (hqId && hqId !== effectiveHqId) {
            return NextResponse.json({ success: false, error: 'No puedes consultar otra sede' }, { status: 403 });
        }

        const ulcers = await prisma.pressureUlcer.findMany({
            where: {
                status: { in: ['ACTIVE', 'HEALING'] },
                patient: { headquartersId: effectiveHqId },
            },
            include: {
                patient: { select: { id: true, name: true, roomNumber: true, colorGroup: true } },
                logs: { take: 1, orderBy: { createdAt: 'desc' }, include: { nurse: { select: { name: true } } } },
            },
            orderBy: [{ stage: 'desc' }, { identifiedAt: 'desc' }],
        });

        return NextResponse.json({ success: true, ulcers });
    } catch (err: any) {
        console.error('[UPP GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/care/upp
 * Body: { patientId, stage, bodyLocation, treatmentApplied, notes, woundSize? }
 * Crea PressureUlcer + UlcerLog inicial + Notification + TriageTicket.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        if (!WRITE_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo NURSE, DIRECTOR, ADMIN o SUPERVISOR pueden registrar úlceras' }, { status: 403 });
        }

        const invokerId = (session.user as any).id;
        const invokerHqId = (session.user as any).headquartersId;

        const body = await req.json();
        const { patientId, stage, bodyLocation, treatmentApplied, notes, woundSize } = body;

        if (!patientId || !stage || !bodyLocation || !treatmentApplied) {
            return NextResponse.json({ success: false, error: 'Faltan campos: patientId, stage, bodyLocation, treatmentApplied' }, { status: 400 });
        }

        const stageInt = typeof stage === 'string' ? parseInt(stage, 10) : stage;
        if (![1, 2, 3, 4].includes(stageInt)) {
            return NextResponse.json({ success: false, error: 'Stage debe ser 1, 2, 3 o 4' }, { status: 400 });
        }

        // Validar paciente en sede
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            select: { id: true, name: true, headquartersId: true },
        });
        if (!patient) return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });

        // Crear úlcera + log inicial + triage ticket (transacción)
        const [ulcer, _log, ticket] = await prisma.$transaction(async (tx) => {
            const u = await tx.pressureUlcer.create({
                data: {
                    patientId,
                    stage: stageInt,
                    bodyLocation,
                    status: 'ACTIVE',
                    identifiedAt: new Date(),
                },
            });

            const l = await tx.ulcerLog.create({
                data: {
                    ulcerId: u.id,
                    nurseId: invokerId,
                    notes: notes || `Declaración inicial de UPP — ${bodyLocation}`,
                    treatmentApplied,
                    woundSize: woundSize || null,
                    hasPhoto: false,
                },
            });

            const t = await tx.triageTicket.create({
                data: {
                    headquartersId: patient.headquartersId,
                    patientId,
                    originType: 'DAILY_LOG',
                    originReferenceId: u.id,
                    priority: stageInt >= 3 ? 'CRITICAL' : 'HIGH',
                    status: 'OPEN',
                    description: `[UPP Estadio ${stageInt}] ${bodyLocation} — ${patient.name}. Tratamiento: ${treatmentApplied}`,
                },
            });

            return [u, l, t];
        });

        // Notificar a supervisores
        try {
            await notifyRoles(patient.headquartersId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'TRIAGE',
                title: 'Nueva UPP registrada',
                message: `${patient.name} — Estadio ${stageInt} en ${bodyLocation}`,
            });
        } catch (e) { console.error('[UPP notify]', e); }

        return NextResponse.json({ success: true, ulcerId: ulcer.id, ticketId: ticket.id });
    } catch (err: any) {
        console.error('[UPP POST]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
