import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const {
            patientId, description, type, photoUrl,
            // Quien planteo el senalamiento. Uno de los dos, no ambos.
            planteadoPorFamiliarId, planteadoPorResidente,
        } = await req.json();
        // HIPAA — el autor sale de la sesión (antes authorId del body).
        const authorId = auth.id;

        if (!patientId || !description || !type) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: { familyMembers: { select: { id: true } } }
        });

        if (!patient) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
        // Tenant check HIPAA — no crear quejas sobre residentes de otra sede
        if (patient.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
        }

        // Quien lo planteo lo dice el supervisor, no lo adivina el codigo.
        //
        // Antes esto era patient.familyMembers[0] — el primero de la lista,
        // tuviera o no algo que ver con lo que se estaba registrando. De los 5
        // senalamientos abiertos en Cupey, 2 arrastran un familiar anclado por
        // ese automatismo. Un senalamiento atribuido a quien no lo hizo es
        // peor que uno sin atribuir.
        let familyMemberId: string | null = null;
        if (planteadoPorFamiliarId) {
            const fm = await prisma.familyMember.findFirst({
                where: { id: planteadoPorFamiliarId, patientId: patient.id },
                select: { id: true },
            });
            if (!fm) {
                return NextResponse.json(
                    { success: false, error: 'Ese familiar no pertenece a este residente.' },
                    { status: 400 },
                );
            }
            familyMemberId = fm.id;
        }

        // Saneo de prefijo: antes hardcoded "Cuidador ID" — ahora resolvemos
        // nombre+rol del autor para que SUPERVISOR/DIRECTOR/NURSE quede correcto.
        const author = await prisma.user.findUnique({
            where: { id: authorId },
            select: { name: true, role: true },
        });
        const roleLabel: Record<string, string> = {
            CAREGIVER: 'Cuidador', NURSE: 'Enfermera', SUPERVISOR: 'Supervisor',
            DIRECTOR: 'Director', ADMIN: 'Admin',
        };
        const prefix = author
            ? `[Reportado por ${roleLabel[author.role as string] || author.role}: ${author.name}]`
            : `[Reportado por usuario ${authorId}]`;

        const complaint = await prisma.complaint.create({
            data: {
                headquartersId: patient.headquartersId,
                patientId: patient.id,
                familyMemberId: familyMemberId,
                planteadoPorResidente: !!planteadoPorResidente,
                // El supervisor es el canal de entrada: informa y direccion resuelve.
                registradoPorId: authorId,
                description: `${prefix} - ${description}`,
                status: "PENDING",
                photoUrl: photoUrl || null // FASE 37
            }
        });

        // Auto-crear TriageTicket para queja
        await prisma.triageTicket.create({
            data: {
                headquartersId: patient.headquartersId,
                patientId: patient.id,
                originType: 'COMPLAINT',
                originReferenceId: complaint.id,
                priority: 'MEDIUM',
                status: 'OPEN',
                description: complaint.description,
            }
        });

        // Recorte de ruido (17-ago-2026): ticket nuevo ya no genera campana —
        // el badge del inbox operativo lo anuncia y persiste hasta atenderse.

        return NextResponse.json({ success: true, complaint });
    } catch (error: any) {
        console.error("Care Complaint POST Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
