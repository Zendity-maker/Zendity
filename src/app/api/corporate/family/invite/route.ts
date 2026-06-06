import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { issueFamilyInviteLink, type InviteVariant } from '@/lib/family-invite-link';

/**
 * POST /api/corporate/family/invite
 *
 * Dos modos:
 *   - Modo A {familyMemberId}                       — reenvío / reset
 *   - Modo B {patientId, name, email, accessLevel}  — crear + invitar
 *
 * El email + token se emite vía issueFamilyInviteLink (lib compartida).
 * Cero PIN en email. Cero passcode/isRegistered tocado al emitir.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes((session.user as any).role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const hqId = (session.user as any).headquartersId;

        let familyMember: any = null;
        let variant: InviteVariant = 'nuevo';

        // Modo A — Resend / Reset: { familyMemberId }
        // Usamos isRegistered del FM como discriminador del copy del email.
        if (body.familyMemberId) {
            familyMember = await prisma.familyMember.findFirst({
                where: { id: body.familyMemberId, headquartersId: hqId },
                select: { id: true, isRegistered: true },
            });
            if (!familyMember) {
                return NextResponse.json({ error: 'Familiar no encontrado' }, { status: 404 });
            }
            variant = familyMember.isRegistered ? 'reset' : 'nuevo';
        }
        // Modo B — Crear + invitar: { patientId, name, email, accessLevel }
        else if (body.patientId && body.name && body.email) {
            const { patientId, name, email, accessLevel } = body;

            const patient = await prisma.patient.findFirst({
                where: { id: patientId, headquartersId: hqId },
                select: { id: true, name: true },
            });
            if (!patient) return NextResponse.json({ error: 'Residente no encontrado' }, { status: 404 });

            const existing = await prisma.familyMember.findUnique({
                where: { email },
                include: { patient: { select: { name: true, headquartersId: true } } },
            });
            if (existing) {
                if (existing.patientId !== patientId) {
                    const sameHq = existing.patient?.headquartersId === hqId;
                    return NextResponse.json({
                        error: sameHq
                            ? `Este email ya está asociado al familiar "${existing.name}" del residente ${existing.patient?.name || 'otro'}. Usa otro email o gestiona desde la ficha de ese residente.`
                            : `Este email ya está usado por otro hogar. Usa un email distinto.`,
                        existingFamilyMemberId: sameHq ? existing.id : undefined,
                        existingPatientId: sameHq ? existing.patientId : undefined,
                        existingPatientName: sameHq ? (existing.patient?.name ?? null) : undefined,
                        existingFamilyMemberName: sameHq ? existing.name : undefined,
                    }, { status: 409 });
                }
                return NextResponse.json({
                    error: existing.isRegistered
                        ? `Ya hay un familiar registrado con ese email ("${existing.name}"). Si olvidó su PIN, usa "Reenviar invitación" para enviar un enlace de reset.`
                        : `Hay una invitación pendiente para ese email ("${existing.name}"). Usa "Reenviar invitación" para mandar un enlace nuevo.`,
                    existingFamilyMemberId: existing.id,
                    existingFamilyMemberName: existing.name,
                    canResend: true,
                }, { status: 409 });
            }

            const level = accessLevel === 'Read-Only' ? 'Read-Only' : 'Full';

            familyMember = await prisma.familyMember.create({
                data: {
                    headquartersId: hqId,
                    patientId,
                    name,
                    email,
                    accessLevel: level,
                    isRegistered: false,
                },
                select: { id: true },
            });
            variant = 'nuevo';
        } else {
            return NextResponse.json({ error: 'familyMemberId o (patientId, name, email) requerido' }, { status: 400 });
        }

        const result = await issueFamilyInviteLink(familyMember.id, variant);
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Error emitiendo enlace' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            variant,
            message: variant === 'reset'
                ? 'Enlace de reset enviado al email del familiar'
                : 'Enlace de invitación enviado al email del familiar',
            emailSent: result.emailSent,
            emailError: result.emailError,
        });
    } catch (error) {
        console.error('Family invite error:', error);
        return NextResponse.json({ error: 'Error enviando invitación' }, { status: 500 });
    }
}
