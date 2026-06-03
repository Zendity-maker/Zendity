import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';



export async function POST(req: Request) {
    try {
        const { patientId, authorId, description, type, photoUrl } = await req.json();

        if (!patientId || !authorId || !description || !type) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: { familyMembers: { select: { id: true } } }
        });

        if (!patient) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });

        // Buscamos un familiar para anclar la queja (o null si el residente no tiene)
        const familyMemberId = patient.familyMembers.length > 0 ? patient.familyMembers[0].id : null;

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

        // Notificar a SUPERVISOR/NURSE/DIRECTOR
        try {
            await notifyRoles(patient.headquartersId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                type: 'TRIAGE',
                title: 'Nuevo ticket de Triage',
                message: `${patient.name} — Queja familiar: ${(description || 'sin descripción').substring(0, 120)}`,
                link: '/corporate/triage',
            });
        } catch (e) { console.error('[notify TRIAGE complaint]', e); }

        return NextResponse.json({ success: true, complaint });
    } catch (error: any) {
        console.error("Care Complaint POST Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
