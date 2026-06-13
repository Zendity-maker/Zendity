import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import { ACTIVE_PRESENCE_MAX_HOURS } from '@/lib/shift-coverage';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { logError } from '@/lib/logger';
import {
    resolveUserFloorScope,
    floorWhereFilter,
    CaregiverFloorMissingError,
    type FloorScope,
} from '@/lib/floor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Obtiene residentes filtrados por el Color seleccionado en el turno
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const colorParam = searchParams.get('color') || 'UNASSIGNED';
        const requestedHqId = searchParams.get('hqId');
        const invokerId = (session.user as any).id;

        // Sprint N.4 — multi-color. El param puede venir como 'RED' (legacy)
        // o 'RED,YELLOW' (sustituto cubriendo varios grupos). Split por coma.
        const colors = colorParam
            ? colorParam.split(',').map(c => c.trim()).filter(Boolean)
            : [];

        // Resolución segura: roles limitados quedan anclados a su sede
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || "Sede inválida" }, { status: 400 });
        }

        // SPRINT MULTI-FLOOR (jun-2026): resolver el scope de piso del invoker.
        // - CAREGIVER con floor=null → 422 (admin debe asignar piso primero).
        // - NURSE / SUPERVISOR / DIRECTOR / ADMIN → scope='ALL' (ven ambos pisos
        //   si llegan a este endpoint; no es el caso típico pero tampoco se
        //   restringe acá — la tablet del cuidador es la consumer principal).
        // Una sola query findUnique adicional por poll. Si se vuelve hot path,
        // mover `floor` al JWT en lib/auth — pero por ahora es marginal.
        const invoker = await prisma.user.findUnique({
            where: { id: invokerId },
            select: { role: true, floor: true },
        });
        if (!invoker) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 401 });
        }
        let floorScope: FloorScope;
        try {
            floorScope = resolveUserFloorScope(
                { role: invoker.role, floor: invoker.floor },
                invokerId,
            );
        } catch (e) {
            if (e instanceof CaregiverFloorMissingError) {
                return NextResponse.json({ success: false, error: e.message }, { status: 422 });
            }
            throw e;
        }

        console.log("CARE API CALLED WITH:", { colors, hqId, floorScope, invokerRole: invoker.role });

        // Guard: un cuidador sin color asignado NO debe ver residentes UNASSIGNED.
        // Antes este caso caía al filtro por colorGroup='UNASSIGNED' y mostraba
        // residentes huérfanos (incluyendo duplicados como los 3 registros de
        // Daniela Arrieta que aparecían en el tablet).
        if (colors.length === 1 && colors[0] === 'UNASSIGNED') {
            return NextResponse.json({ success: true, patients: [], events: [], hospitalizedCount: 0 });
        }

        const todayStart = todayStartAST();
        const todayEnd = new Date();
        // Cap UNIFICADO de presencia (16h sliding). Alineado con
        // isSoloCaregiver y caregiver-rounds — los 3 call-sites que cuentan
        // "presencia" en piso usan el mismo umbral.
        const presenceCap = new Date(Date.now() - ACTIVE_PRESENCE_MAX_HOURS * 60 * 60 * 1000);

        // Nivel 2 — Auto-escalación a ALL para cuidadora solitaria.
        // Si el invocador es el único cuidador clínico (CAREGIVER + NURSE) con
        // sesión activa en SU PISO, ignoramos el filtro de color y mostramos
        // todos los residentes DE SU PISO. Auto-corrige cuando otro cuidador
        // inicia turno porque se recalcula en cada poll.
        //
        // Multi-floor (jun-2026): el conteo ahora es scoped al piso del invoker.
        // Antes era HQ-wide → si piso 1 tenía 1 cuidadora y piso 2 tenía 1, ambas
        // veían `isSolo=false` aunque CADA UNA estuviera sola en su piso. Ahora
        // cada una ve correctamente isSolo=true en su scope.
        // Para invoker con scope='ALL' (NURSE/SUPERVISOR usando esta ruta), el
        // count sigue HQ-wide — coherente con su scope multi-piso.
        const activeCount = await prisma.shiftSession.count({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: presenceCap },
                caregiver: {
                    role: { in: ['CAREGIVER', 'NURSE'] },
                    ...(floorScope === 'ALL' ? {} : { floor: floorScope }),
                },
            },
        });
        const isSolo = activeCount <= 1;

        // Sprint N.4 — Overrides asignados a ESTE cuidador hoy (shiftPatientOverride
        // con isActive=true). Se combinan con el colorFilter propio vía OR para que
        // el tablet muestre "mis residentes del color X + los residentes cubiertos
        // temporalmente por ausencia/redistribución".
        //
        // Multi-floor (jun-2026): los overrides NO se filtran por floor. Si Yari2
        // (piso 2) tiene override para cubrir un residente piso 1 (con flag
        // allowCrossFloor=true en su creación), ese residente DEBE aparecer en
        // su tablet para que pueda documentar la atención. El override es la
        // declaración explícita "este residente es responsabilidad de Yari2 hoy",
        // independientemente del piso. Esta es la regla "primario floor-scoped,
        // override floor-bypass" del principio acordado (jun-2026).
        const overrideRows = await prisma.shiftPatientOverride.findMany({
            where: {
                caregiverId: invokerId,
                headquartersId: hqId,
                isActive: true,
                shiftDate: { gte: todayStart },
            },
            select: { patientId: true, originalColor: true, reason: true },
        });
        const overridePatientIds = overrideRows.map(o => o.patientId);
        const overrideByPatientId = new Map(overrideRows.map(o => [o.patientId, o]));

        // Filtro por color propio. Si la cuidadora es la única en piso, se
        // ignora el filtro y se traen todos.
        const includesAll = colors.includes('ALL') || isSolo;
        const ownColorFilter = (colors.length === 0 || includesAll)
            ? {}
            : { colorGroup: { in: colors as any[] } };

        const baseStatusFilter = {
            headquartersId: hqId,
            status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] as any },
        };

        // Multi-floor filtro para la rama OWN (primario): residentes del piso
        // del invoker. Para scope='ALL' es {} (sin filtro). Aplica SOLO a la
        // rama OWN — la rama OVERRIDE (override IDs) lo BYPASEA por diseño,
        // ver comentario arriba.
        const ownFloorFilter = floorWhereFilter(floorScope);

        const where = overridePatientIds.length > 0
            ? {
                OR: [
                    { ...ownColorFilter, ...baseStatusFilter, ...ownFloorFilter },
                    { id: { in: overridePatientIds }, ...baseStatusFilter },
                ],
            }
            : {
                ...ownColorFilter,
                ...baseStatusFilter,
                ...ownFloorFilter,
            };

        const patientsRaw = await prisma.patient.findMany({
            where,
            include: {
                medications: {
                    where: {
                        isActive: true,
                        status: { in: ['ACTIVE', 'PRN'] }
                    },
                    include: {
                        medication: true,
                        // Administraciones de HOY (ventana AST) para calcular packs completos en el tablet
                        administrations: {
                            where: {
                                createdAt: { gte: todayStart, lte: todayEnd },
                                status: { in: ['ADMINISTERED', 'OMITTED', 'REFUSED'] }
                            },
                            select: { id: true, status: true, scheduleTime: true, createdAt: true, notes: true }
                        }
                    }
                },
                lifePlans: { orderBy: { createdAt: 'desc' }, take: 1 },
                mealLogs: {
                    where: { timeLogged: { gte: todayStart, lte: todayEnd } },
                    distinct: ['mealType'],
                    select: { id: true, mealType: true }
                },
                vitalSigns: {
                    where: { createdAt: { gte: todayStart, lte: todayEnd } },
                    select: { id: true, systolic: true, diastolic: true, heartRate: true, temperature: true, glucose: true, createdAt: true },
                    orderBy: { createdAt: 'desc' }
                },
                bathLogs: {
                    where: { timeLogged: { gte: todayStart, lte: todayEnd } },
                    select: { id: true },
                    take: 1
                },
                pressureUlcers: {
                    where: { status: 'ACTIVE' },
                    select: { id: true }
                },
                posturalChanges: {
                    orderBy: { performedAt: 'desc' },
                    take: 1
                },
                vitalsOrders: {
                    where: { status: 'PENDING' },
                    orderBy: { orderedAt: 'desc' },
                    take: 1,
                    select: { id: true, expiresAt: true, reason: true, orderedAt: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // FASE 80: Residentes en hospital permanecen en el censo (con badge),
        // pero sus medicamentos NO aparecen en el eMAR activo del turno.
        // Sprint N.4: anexar overrideInfo al residente que está cubierto por
        // redistribución (para pintar el badge "COBERTURA [COLOR]" en el tablet).
        const patients = patientsRaw.map(p => {
            const override = overrideByPatientId.get(p.id);
            const base = p.status === 'TEMPORARY_LEAVE' ? { ...p, medications: [] } : p;
            if (override) {
                return {
                    ...base,
                    overrideInfo: {
                        originalColor: override.originalColor,
                        reason: override.reason,
                    },
                };
            }
            return base;
        });

        const hospitalizedCount = patientsRaw.filter(p => p.status === 'TEMPORARY_LEAVE' && p.leaveType === 'HOSPITAL').length;

        // Nivel 3 — desglose propios vs cobertura para el header del tablet.
        const overrideSet = new Set(overridePatientIds);
        const ownCount = patientsRaw.filter(p => !overrideSet.has(p.id)).length;
        const coverageCount = patientsRaw.filter(p => overrideSet.has(p.id)).length;

        // Events targeted a este cuidador: ALL + match con cualquiera de sus colores.
        // Si es cuidadora solitaria (isSolo → includesAll forzado), ve todos los eventos.
        const eventColorOrs = colors.length > 0 && !includesAll
            ? colors.map(c => ({ targetGroups: { has: c } }))
            : [];

        const events = await prisma.headquartersEvent.findMany({
            where: {
                headquartersId: hqId,
                startTime: { gte: todayStart, lte: todayEnd },
                type: { not: 'INFRASTRUCTURE' },
                assignedToId: null,
                targetPopulation: { not: 'STAFF' },
                title: { not: { startsWith: 'Ronda de Supervisor' } },
                OR: [
                    { targetPopulation: 'ALL' },
                    ...eventColorOrs,
                ],
            },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        return NextResponse.json({
            success: true,
            patients,
            events,
            hospitalizedCount,
            isSolo,
            ownCount,
            coverageCount,
        });
    } catch (error: any) {
        logError('care.get', error);
        return NextResponse.json({ success: false, error: "Error: " + (error.message || String(error)) }, { status: 500 });
    }
}
