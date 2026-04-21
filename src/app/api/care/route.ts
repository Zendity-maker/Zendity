import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

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
        const color = searchParams.get('color') || 'UNASSIGNED';
        const requestedHqId = searchParams.get('hqId');

        // Resolución segura: roles limitados quedan anclados a su sede
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || "Sede inválida" }, { status: 400 });
        }

        console.log("CARE API CALLED WITH:", { color, hqId });

        // Guard: un cuidador sin color asignado NO debe ver residentes UNASSIGNED.
        // Antes este caso caía al filtro por colorGroup='UNASSIGNED' y mostraba
        // residentes huérfanos (incluyendo duplicados como los 3 registros de
        // Daniela Arrieta que aparecían en el tablet). Devolvemos lista vacía
        // para forzar que el cuidador reciba su color desde ShiftColorAssignment.
        if (color === 'UNASSIGNED') {
            return NextResponse.json({ success: true, patients: [], events: [], hospitalizedCount: 0 });
        }

        const todayStart = todayStartAST();
        const todayEnd = new Date();

        // Cuidador solitario / turno "Todos": sin filtro por colorGroup.
        // Color específico → filtrar por ese color.
        const colorFilter = (!color || color === 'ALL')
            ? {}
            : { colorGroup: color as any };

        const patientsRaw = await prisma.patient.findMany({
            where: {
                ...colorFilter,
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] }
            },
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
                lifePlan: true,
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
        const patients = patientsRaw.map(p => {
            if (p.status === 'TEMPORARY_LEAVE') {
                return { ...p, medications: [] };
            }
            return p;
        });

        const hospitalizedCount = patientsRaw.filter(p => p.status === 'TEMPORARY_LEAVE' && p.leaveType === 'HOSPITAL').length;

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
                    { targetGroups: { has: color } },
                ],
            },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        return NextResponse.json({ success: true, patients, events, hospitalizedCount });
    } catch (error: any) {
        console.error("Care Fetch Error:", error);
        return NextResponse.json({ success: false, error: "Error: " + (error.message || String(error)) }, { status: 500 });
    }
}
