import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { HrIncidentSeverity, IncidentCategory, IncidentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Datos disciplinarios — solo SUPERVISOR/DIRECTOR/ADMIN (RR.HH.)
const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const body = await req.json();
        const {
            employeeId,
            description,
            severity,
            category,
            directorNote,
            relatedPatientId,
            // Legacy fields (retro-compat)
            type,
            signatureBase64,
        } = body;

        if (!employeeId || !description) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos (employeeId, description).' }, { status: 400 });
        }

        // Tenant check: empleado debe pertenecer a la sede del invocador
        const employee = await prisma.user.findFirst({
            where: { id: employeeId, headquartersId: hqId },
            select: { id: true }
        });
        if (!employee) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 });
        }

        // Normalizar enums
        const sev: HrIncidentSeverity = Object.values(HrIncidentSeverity).includes(severity)
            ? severity
            : HrIncidentSeverity.OBSERVATION;
        const cat: IncidentCategory = Object.values(IncidentCategory).includes(category)
            ? category
            : IncidentCategory.OTHER;

        // Legacy "type" se deriva de severity si no viene explícito
        const legacyType = type || (sev === 'OBSERVATION' ? 'WARNING' : sev);

        const newIncident = await prisma.incidentReport.create({
            data: {
                employeeId,
                supervisorId: invokerId,
                headquartersId: hqId,
                type: legacyType,
                description,
                severity: sev,
                category: cat,
                status: IncidentStatus.DRAFT,
                visibleToEmployee: false,
                directorNote: directorNote || null,
                relatedPatientId: relatedPatientId || null,
                signatureBase64: signatureBase64 || null,
                signedAt: signatureBase64 ? new Date() : null,
            },
            include: {
                employee: { select: { id: true, name: true, role: true } },
                supervisor: { select: { id: true, name: true, role: true } }
            }
        });

        // En DRAFT NO se notifica al empleado ni se envía email.
        // El flujo dispara notificaciones cuando el director decide (decide endpoint).

        return NextResponse.json({ success: true, incident: newIncident });
    } catch (error: any) {
        console.error("Error creating HR incident:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;

        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');
        const statusFilter = searchParams.get('status');
        const severityFilter = searchParams.get('severity');

        const isHr = ALLOWED_ROLES.includes(invokerRole);

        // Si no es HR: el empleado sólo puede ver SUS incidentes visibles
        if (!isHr) {
            const whereSelf: any = {
                employeeId: invokerId,
                headquartersId: hqId,
                visibleToEmployee: true,
            };
            const incidents = await prisma.incidentReport.findMany({
                where: whereSelf,
                include: {
                    supervisor: { select: { id: true, name: true, role: true } },
                    employee: { select: { id: true, name: true, role: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
            return NextResponse.json({ success: true, incidents });
        }

        // HR: puede listar todos de la sede
        const whereClause: any = { headquartersId: hqId };
        if (employeeId) {
            const employee = await prisma.user.findFirst({
                where: { id: employeeId, headquartersId: hqId },
                select: { id: true }
            });
            if (!employee) {
                return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 });
            }
            whereClause.employeeId = employeeId;
        }
        if (statusFilter) whereClause.status = statusFilter;
        if (severityFilter) whereClause.severity = severityFilter;

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
