import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

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

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const patients = await prisma.patient.findMany({
            where: {
                colorGroup: color as any,
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] }
            },
            include: {
                medications: { include: { medication: true } },
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
                }
            },
            orderBy: { name: 'asc' }
        });

        const events = await prisma.headquartersEvent.findMany({
            where: {
                headquartersId: hqId,
                startTime: { gte: todayStart, lte: todayEnd }
            },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        return NextResponse.json({ success: true, patients, events });
    } catch (error: any) {
        console.error("Care Fetch Error:", error);
        return NextResponse.json({ success: false, error: "Error: " + (error.message || String(error)) }, { status: 500 });
    }
}
