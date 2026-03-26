import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export const revalidate = 0;



export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get("hqId");

        const filterHQ = hqId && hqId !== "ALL" ? { headquartersId: hqId } : {};
        const filterPatientHQ = hqId && hqId !== "ALL" ? { patient: { headquartersId: hqId } } : {};

        // Query en paralelo a los 3 canales de reportes
        const [complaints, incidents, clinicalAlerts] = await Promise.all([
            prisma.complaint.findMany({
                where: { ...filterHQ, status: "PENDING" },
                include: { patient: { select: { name: true, roomNumber: true } }, familyMember: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.headquartersEvent.findMany({
                where: { ...filterHQ, type: "OTHER", status: "PENDING" },
                include: { patient: { select: { name: true, roomNumber: true } } },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.dailyLog.findMany({
                where: { isClinicalAlert: true, isResolved: false, ...filterPatientHQ },
                include: { patient: { select: { name: true, roomNumber: true } }, author: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // Formateador estándar para que el Frontend (Triage Board) los renderice igual
        const formatTickets = (source: any[], moduleName: string) => source.map(item => {
            let title = "";
            let description = item.description || item.notes || "Reporte sin descripción";
            let severity = "LOW";

            if (moduleName === "COMPLAINT") {
                title = `Queja / Situación Familiar - ${item.familyMember?.name || "Familia"}`;
                severity = "MEDIUM";
            } else if (moduleName === "INCIDENT") {
                title = item.title || "Incidente Operacional";
                severity = "LOW";
            } else if (moduleName === "CLINICAL_ALERT") {
                title = "Alerta Sensible / Cambio Clínico";
                severity = "HIGH";
                description = `[Enfermero/a Autor: ${item.author?.name}] ${description}`;
            }

            return {
                id: item.id,
                module: moduleName,
                title,
                description,
                severity,
                createdAt: item.createdAt,
                patientId: item.patientId || null,
                patientName: item.patient?.name || "Global / Área Común",
                roomNumber: item.patient?.roomNumber || "N/A",
                photoUrl: item.photoUrl || null
            }
        });

        // Combinar todos los tickets y ordenarlos unificadamente del más reciente al más antiguo
        const allTickets = [
            ...formatTickets(complaints, 'COMPLAINT'),
            ...formatTickets(incidents, 'INCIDENT'),
            ...formatTickets(clinicalAlerts, 'CLINICAL_ALERT')
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ success: true, tickets: allTickets });

    } catch (e: any) {
        console.error("Triage Pending Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
