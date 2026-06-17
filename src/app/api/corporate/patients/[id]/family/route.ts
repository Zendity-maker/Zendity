import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { issueFamilyInviteLink } from '@/lib/family-invite-link';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { requireRole } from '@/lib/api-auth';

// GET: Obtain the list of family members for a patient
// PHI audit (Pilar 1) — single-patient list; patientId del param.
// Sprint Coordinador (jun-2026): wrapped antes de exponer a COORDINATOR
// (los datos de contacto familiar son PHI). Role gate via requireRole para
// primary OR secondaryRoles consistente con el resto del repo.
export const GET = withPhiAccessLog(getFamilyMembersHandler, {
    resourceType: 'FamilyMember',
    getPatientId: async ({ params }) => (await params).id,
});

async function getFamilyMembersHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: patientId } = await params;
        const auth = await requireRole(['ADMIN', 'DIRECTOR', 'NURSE', 'COORDINATOR']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const familyMembers = await prisma.familyMember.findMany({
            where: {
                patientId: patientId,
                headquartersId: hqId
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json({ success: true, familyMembers });
    } catch (error) {
        console.error("Error fetching family members:", error);
        return NextResponse.json({ success: false, error: "Error al cargar familiares." }, { status: 500 });
    }
}

// POST: Register a new family member
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "Privilegios insuficientes para asignar accesos." }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const {
            name, email, phone, accessLevel, relationship,
            // Sprint P — Admisión Unificada
            address, idCardUrl, isPrimary,
        } = await req.json();

        if (!name || !email) {
            return NextResponse.json({ success: false, error: "Debe proveer al menos Nombre y Email." }, { status: 400 });
        }

        // Check if email already exists globally (emails must be unique across the system for family members)
        const existingEmail = await prisma.familyMember.findUnique({
            where: { email: email }
        });

        // Si ya existe, actualizar (upsert-like) — útil desde el wizard de admisión
        if (existingEmail) {
            if (existingEmail.patientId !== patientId || existingEmail.headquartersId !== hqId) {
                return NextResponse.json({ success: false, error: "El email ingresado ya está asociado a otra cuenta." }, { status: 400 });
            }
            const updated = await prisma.familyMember.update({
                where: { id: existingEmail.id },
                data: {
                    name,
                    ...(phone !== undefined ? { phone: phone || null } : {}),
                    ...(accessLevel !== undefined ? { accessLevel: accessLevel || "Full" } : {}),
                    ...(relationship !== undefined ? { relationship: relationship || null } : {}),
                    ...(address !== undefined ? { address: address || null } : {}),
                    ...(idCardUrl !== undefined ? { idCardUrl: idCardUrl || null } : {}),
                    ...(isPrimary !== undefined ? { isPrimary: !!isPrimary } : {}),
                }
            });
            // Si se marca como primario, limpiar otros primarios del mismo paciente
            if (isPrimary === true) {
                await prisma.familyMember.updateMany({
                    where: { patientId, id: { not: updated.id }, isPrimary: true },
                    data: { isPrimary: false },
                });
                await prisma.patient.update({
                    where: { id: patientId },
                    data: { primaryFamilyMemberId: updated.id },
                });
            }
            return NextResponse.json({ success: true, familyMember: updated, updated: true });
        }

        // INSERT pending — el familiar elige su PIN via /family/register?token=X.
        // isRegistered=false, passcode=null hasta que el familiar complete activate.
        const newFamilyMember = await prisma.familyMember.create({
            data: {
                patientId: patientId,
                headquartersId: hqId,
                name,
                email,
                phone: phone || null,
                passcode: null,
                isRegistered: false,
                accessLevel: accessLevel || "Full",
                relationship: relationship || null,
                address: address || null,
                idCardUrl: idCardUrl || null,
                isPrimary: !!isPrimary,
            }
        });

        // Si es el primario, desmarcar otros + setear en Patient.
        // Esto es ortogonal al onboarding del PIN — el FM puede ser primary
        // aunque aún no haya activado su acceso.
        if (isPrimary === true) {
            await prisma.familyMember.updateMany({
                where: { patientId, id: { not: newFamilyMember.id }, isPrimary: true },
                data: { isPrimary: false },
            });
            await prisma.patient.update({
                where: { id: patientId },
                data: { primaryFamilyMemberId: newFamilyMember.id },
            });
        }

        // Emitir token + enviar email de invitación vía lib compartida.
        // El UPDATE del token persiste aunque sgMail falle — el director puede
        // reenviar desde /corporate/family/invite (Modo A) sin regenerar el FM.
        const result = await issueFamilyInviteLink(newFamilyMember.id, 'nuevo');
        if (result.emailSent) {
            console.log(`[ONBOARDING] Enlace de invitación enviado a: ${email}`);
        } else {
            console.warn(`[ONBOARDING] Email no enviado a ${email}:`, result.emailError);
        }

        // Conserva la forma { emailFailed, emailError } que la UI del wizard
        // ya consume — sin sorpresas para Tab5 del intake.
        return NextResponse.json({
            success: true,
            familyMember: newFamilyMember,
            emailFailed: !result.emailSent,
            emailError: result.emailError,
        });
    } catch (error) {
        console.error("Error creating family member:", error);
        return NextResponse.json({ success: false, error: "Error al crear el perfil del familiar." }, { status: 500 });
    }
}

// DELETE: Revoke a family member's access
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "Privilegios insuficientes para revocar accesos." }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { searchParams } = new URL(req.url);
        const familyMemberId = searchParams.get('familyMemberId');

        if (!familyMemberId) {
            return NextResponse.json({ success: false, error: "ID del familiar requerido." }, { status: 400 });
        }

        // Ensure the family member belongs to this patient and HQ
        const existingMember = await prisma.familyMember.findUnique({
            where: { id: familyMemberId }
        });

        if (!existingMember || existingMember.patientId !== patientId || existingMember.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: "Acceso no autorizado o familiar no encontrado." }, { status: 403 });
        }

        await prisma.familyMember.delete({
            where: { id: familyMemberId }
        });

        return NextResponse.json({ success: true, message: "Acceso revocado exitosamente." });
    } catch (error) {
        console.error("Error deleting family member:", error);
        return NextResponse.json({ success: false, error: "Error al revocar el acceso." }, { status: 500 });
    }
}
