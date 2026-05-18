import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { inferShiftTypeFromAST, type ShiftT } from '@/lib/shift-coverage';
import { todayStartAST } from '@/lib/dates';
import { redistributeUncoveredColors } from '@/lib/shift-redistribute';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MANUAL_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * POST /api/care/shift/redistribute
 *
 * Body: { hqId?, shiftType?, trigger: 'AUTO' | 'MANUAL' }
 *
 * Autenticación doble:
 *  - Manual: sesión de SUPERVISOR/DIRECTOR/ADMIN
 *  - Automática: header Authorization: Bearer <CRON_SECRET> (llamada del cron)
 *
 * Reparte round-robin los residentes de colores ausentes entre los cuidadores
 * activos que tienen color efectivo asignado. Crea ShiftPatientOverride por
 * residente + VitalsOrder si la ventana 4h del shiftSession del receptor no
 * ha vencido. Notifica receptores y supervisor.
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'ZENDITY_CRON_LOCAL';
        const isCron = authHeader === `Bearer ${cronSecret}`;

        let session: Session | null = null;
        if (!isCron) {
            session = await getServerSession(authOptions);
            if (!session?.user) {
                return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
            }
            if (!MANUAL_ROLES.includes((session.user as any).role)) {
                return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
            }
        }

        const body = await req.json().catch(() => ({}));
        const requestedHqId: string | undefined = body.hqId;
        const shiftTypeParam: ShiftT | undefined = body.shiftType;
        const trigger: 'AUTO' | 'MANUAL' = body.trigger === 'AUTO' ? 'AUTO' : (isCron ? 'AUTO' : 'MANUAL');

        let hqId: string;
        if (isCron) {
            if (!requestedHqId) {
                return NextResponse.json({ success: false, error: 'hqId requerido en llamada cron' }, { status: 400 });
            }
            const hq = await prisma.headquarters.findFirst({
                where: { id: requestedHqId, isActive: true },
                select: { id: true },
            });
            if (!hq) {
                return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });
            }
            hqId = requestedHqId;
        } else {
            try {
                hqId = await resolveEffectiveHqId(session!, requestedHqId || null);
            } catch (e: any) {
                return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
            }
        }

        const shiftType: ShiftT = shiftTypeParam && ['MORNING', 'EVENING', 'NIGHT'].includes(shiftTypeParam)
            ? shiftTypeParam
            : inferShiftTypeFromAST();

        // Delega al helper unificado. computeShiftCoverage + round-robin +
        // idempotencia + vitales + notificaciones viven todos ahí.
        const result = await redistributeUncoveredColors({
            hqId,
            shiftType,
            trigger,
        });

        if (result.error) {
            return NextResponse.json({ success: false, error: result.error.message }, { status: result.error.status });
        }

        // Sin huecos o todo ya redistribuido
        if (!result.coverage.redistributionNeeded || result.overridesCreated.length === 0) {
            return NextResponse.json({
                success: true,
                redistributed: 0,
                overridesCreated: [],
                vitalsCreated: 0,
                message: result.coverage.redistributionNeeded
                    ? 'Sin pacientes para redistribuir (todos ya tienen override activo)'
                    : 'No hay huecos — cobertura completa o ya redistribuida',
                coverage: {
                    absentColors: result.coverage.absentColors,
                    alreadyRedistributed: result.coverage.alreadyRedistributed,
                },
            });
        }

        // Audit log
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: result.overridesCreated[0].id,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: isCron ? null : (session!.user as any).id,
                    payloadChanges: {
                        trigger,
                        shiftType,
                        shiftDate: todayStartAST().toISOString(),
                        absentColors: result.coverage.absentColors,
                        redistributedCount: result.overridesCreated.length,
                        vitalsCreated: result.vitalsCreated,
                        recipientsCount: result.notifyByCaregiver.size,
                        overrideIds: result.overridesCreated.map(o => o.id),
                    } as any,
                },
            });
        } catch (e) { logWarn('care.shift.redistribute.audit', e, { hqId, shiftType, trigger }); }

        return NextResponse.json({
            success: true,
            redistributed: result.overridesCreated.length,
            overridesCreated: result.overridesCreated,
            vitalsCreated: result.vitalsCreated,
            trigger,
            shiftType,
        });
    } catch (error: any) {
        logError('care.shift.redistribute.post', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error ejecutando redistribución',
        }, { status: 500 });
    }
}
