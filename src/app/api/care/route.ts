import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Obtiene residentes filtrados por el Color seleccionado en el turno
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const color = searchParams.get('color') || 'UNASSIGNED';
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ success: false, error: "Headquarters ID requerido" }, { status: 400 });
        }

        console.log("CARE API CALLED WITH:", { color, hqId });

        const todayStart = todayStartAST();
        const todayEnd = new Date();

        const patientsRaw = await prisma.patient.findMany({
            where: {
                colorGroup: color as any,
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] }
            },
            include: {
                medications: {
                    where: {
                        isActive: true,
                        status: { in: ['ACTIVE', 'PRN'] }
                    },
                    include: { medication: true }
                },
                lifePlan: true,
                mealLogs: {
                    where: { timeLogged: { gte: todayStart, lte: todayEnd } },
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
