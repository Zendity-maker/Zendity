import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Retorna los reportes enviados por el cuidador hoy (Action Hub)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const authorId = searchParams.get('authorId');
        const hqId = searchParams.get('hqId');

        if (!authorId || !hqId) {
            return NextResponse.json({ success: false, error: "authorId y hqId requeridos" }, { status: 400 });
        }

        const todayStart = todayStartAST();
        const todayEnd = new Date();

        const [clinicalAlerts, maintenanceReports, complaints] = await Promise.all([
            // 1. Alertas clínicas y UPP (DailyLog con isClinicalAlert = true)
            prisma.dailyLog.findMany({
                where: {
                    authorId,
                    isClinicalAlert: true,
                    createdAt: { gte: todayStart, lte: todayEnd }
                },
                include: {
                    patient: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            // 2. Reportes de mantenimiento (HeadquartersEvent tipo INFRASTRUCTURE creados por este cuidador)
            prisma.headquartersEvent.findMany({
                where: {
                    headquartersId: hqId,
                    type: 'INFRASTRUCTURE',
                    description: { contains: authorId },
                    startTime: { gte: todayStart, lte: todayEnd }
                },
                include: {
                    patient: { select: { id: true, name: true } }
                },
                orderBy: { startTime: 'desc' }
            }),
            // 3. Quejas familiares / reportes de queja (description contiene el authorId del cuidador)
            prisma.complaint.findMany({
                where: {
                    headquartersId: hqId,
                    description: { contains: authorId },
                    createdAt: { gte: todayStart, lte: todayEnd }
                },
                include: {
                    patient: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // Normalizar en un formato unificado
        const reports: any[] = [];

        clinicalAlerts.forEach(log => {
            const isUPP = (log.notes || '').includes('[ALERTA UPP');
            reports.push({
                id: log.id,
                type: isUPP ? 'UPP_ALERT' : 'CLINICAL',
                label: isUPP ? 'Alerta UPP/Piel' : 'Alerta Clínica',
                description: log.notes || '',
                patientName: log.patient?.name || 'N/A',
                createdAt: log.createdAt,
                resolved: log.isResolved
            });
        });

        maintenanceReports.forEach(evt => {
            reports.push({
                id: evt.id,
                type: 'MAINTENANCE',
                label: 'Mantenimiento',
                description: evt.description || evt.title,
                patientName: evt.patient?.name || 'Edificio',
                createdAt: evt.startTime,
                resolved: false
            });
        });

        complaints.forEach(c => {
            reports.push({
                id: c.id,
                type: 'COMPLAINT',
                label: 'Queja / Reporte Familiar',
                description: c.description,
                patientName: (c as any).patient?.name || 'N/A',
                createdAt: c.createdAt,
                resolved: c.status === 'RESOLVED'
            });
        });

        // Ordenar por más reciente primero
        reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ success: true, reports });
    } catch (error: any) {
        console.error("My Reports GET Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
