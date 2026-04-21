import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import {
    inferShiftType,
    resolveColorGroupsForCaregiver,
    resolvePatientsByColors,
    collectShiftActivity,
    buildZendiSummary,
} from '@/lib/shift-closure-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * POST /api/care/shift/preview
 *
 * Genera el reporte Zendi de cierre de turno SIN commit a la BD.
 * El wizard lo llama antes de mostrar la firma para que el cuidador
 * lea exactamente lo que se va a guardar y pueda confirmar.
 *
 * Body: { shiftSessionId, justifications?: Record<string,string> }
 * Response: { success, aiSummaryReport, source, shiftType, patients,
 *             colorGroups, activity }
 */
export async function POST(req: Request) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (authSession.user as any).id;
        const invokerRole = (authSession.user as any).role;
        const invokerHqId = (authSession.user as any).headquartersId;

        const body = await req.json().catch(() => ({}));
        const shiftSessionId: string | undefined = body.shiftSessionId;
        const justifications = (body.justifications ?? {}) as Record<string, string>;

        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: 'shiftSessionId requerido' }, { status: 400 });
        }

        const session = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            include: { caregiver: { select: { id: true, name: true } } },
        });
        if (!session) {
            return NextResponse.json({ success: false, error: 'Turno no encontrado' }, { status: 404 });
        }

        const isOwner = session.caregiverId === invokerId;
        const isSupervisor = SUPERVISOR_ROLES.includes(invokerRole) && session.headquartersId === invokerHqId;
        if (!isOwner && !isSupervisor) {
            return NextResponse.json({ success: false, error: 'Sin permiso para previsualizar este turno' }, { status: 403 });
        }

        const now = new Date();
        const shiftTypeDraft = inferShiftType(now);
        const shiftStart = session.startTime < todayStartAST() ? todayStartAST() : session.startTime;

        const colorGroups = await resolveColorGroupsForCaregiver(session.caregiverId, session.headquartersId, shiftStart);
        const patients = await resolvePatientsByColors(colorGroups, session.headquartersId);
        const activity = await collectShiftActivity({
            caregiverId: session.caregiverId,
            patientIds: patients.map(p => p.id),
            shiftStart,
        });

        const { summary, source } = await buildZendiSummary({
            caregiverName: session.caregiver?.name || 'Cuidador(a)',
            shiftType: shiftTypeDraft,
            patients,
            activity,
            justifications,
        });

        return NextResponse.json({
            success: true,
            aiSummaryReport: summary,
            source,
            shiftType: shiftTypeDraft,
            colorGroups,
            patients: patients.map(p => ({ id: p.id, name: p.name, colorGroup: p.colorGroup, roomNumber: p.roomNumber })),
            activity: {
                medsAdministered: activity.medsAdministered,
                medsOmittedCount: activity.medsOmitted.length,
                mealCount: activity.mealCount,
                bathCount: activity.bathCount,
                vitalCount: activity.vitalCount,
                rotations: activity.rotations,
                fallsCount: activity.falls.length,
                clinicalAlertsCount: activity.clinicalAlerts.length,
            },
        });
    } catch (error: any) {
        console.error('shift/preview error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error generando vista previa del reporte',
        }, { status: 500 });
    }
}
