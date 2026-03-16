import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { employeeId, supervisorId, headquartersId, type, description, signatureBase64 } = body;

        if (!employeeId || !supervisorId || !headquartersId || !type || !description) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos.' }, { status: 400 });
        }

        const newIncident = await prisma.incidentReport.create({
            data: {
                employeeId,
                supervisorId,
                headquartersId,
                type,
                description,
                signatureBase64: signatureBase64 || null,
                signedAt: signatureBase64 ? new Date() : null,
            }
        });

        return NextResponse.json({ success: true, incident: newIncident });
    } catch (error: any) {
        console.error("Error creating HR incident:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');
        const hqId = searchParams.get('hqId');

        if (!hqId) return NextResponse.json({ success: false, error: 'Falta HQ ID' }, { status: 400 });

        const whereClause: any = { headquartersId: hqId };
        if (employeeId) whereClause.employeeId = employeeId;

        const incidents = await prisma.incidentReport.findMany({
            where: whereClause,
            include: {
                supervisor: { select: { id: true, name: true, role: true } },
                employee: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, incidents });
    } catch (error: any) {
        console.error("Error fetching HR incidents:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
