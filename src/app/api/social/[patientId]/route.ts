import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { logError } from '@/lib/logger';

const SW_ALLOWED = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

async function getHandler(_req: Request, { params }: { params: Promise<{ patientId: string }> }) {
    try {
        const { patientId } = await params;
        const auth = await requireRole(SW_ALLOWED);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        // Tenant-scope: cargar patient CON filtro hqId. Si no es de la HQ
        // del invoker, retornamos 404 — el caller no distingue cross-tenant
        // vs not-found (lo cual es la respuesta correcta para evitar
        // enumeration de IDs).
        //
        // FIX 2026-05-31: específicamente quitado el bloque de SpecialistVisit
        // (modelo legacy con 0 datos en prod, reemplazado por
        // ExternalServiceVisit vía kiosko de pisos). El frontend de
        // PatientExternalServicesTab consulta directamente
        // /api/corporate/external-services/visits?patientId=...
        const [notes, tasks, benefits, patient] = await Promise.all([
            prisma.socialWorkNote.findMany({
                where: { patientId, headquartersId: hqId },
                include: { createdBy: { select: { id: true, name: true, role: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.socialWorkTask.findMany({
                where: { patientId, headquartersId: hqId },
                include: {
                    createdBy: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true } },
                },
                orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
            }),
            prisma.socialWorkBenefit.findMany({
                where: { patientId, headquartersId: hqId },
                orderBy: { type: 'asc' },
            }),
            prisma.patient.findFirst({
                where: { id: patientId, headquartersId: hqId },
                select: {
                    id: true,
                    name: true,
                    dateOfBirth: true,
                    status: true,
                    roomNumber: true,
                    diet: true,
                    familyMembers: { select: { id: true, name: true, email: true, accessLevel: true } },
                    vitalSigns: { orderBy: { createdAt: 'desc' }, take: 1 },
                    dailyLogs: { orderBy: { createdAt: 'desc' }, take: 3 },
                },
            }),
        ]);

        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        return NextResponse.json({ success: true, notes, tasks, benefits, patient });
    } catch (error) {
        logError('social.patientId.get', error);
        return NextResponse.json({ success: false, error: 'Error cargando datos sociales' }, { status: 500 });
    }
}

// PHI audit (HIPAA Pilar 1) — patientId del URL → wrapper lo captura.
export const GET = withPhiAccessLog(getHandler, {
    resourceType: 'SocialWorkPatientView',
    getPatientId: async ({ params }) => (await params).patientId,
});
