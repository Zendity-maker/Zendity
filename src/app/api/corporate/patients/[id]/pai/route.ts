import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyUser } from '@/lib/notifications';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

async function assertTenantAccess(patientId: string, hqId: string) {
    const patient = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: hqId },
        select: { id: true }
    });
    return !!patient;
}

// GET — Devuelve el PAI más reciente del residente
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes((session.user as any).role)) return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });

        const resolvedParams = await params;
        const patientId = resolvedParams.id;
        if (!patientId) return NextResponse.json({ success: false, error: 'Patient ID missing' }, { status: 400 });

        if (!(await assertTenantAccess(patientId, hqId))) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        // findFirst ordenado por createdAt → siempre el más reciente
        const lifePlan = await prisma.lifePlan.findFirst({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
            include: {
                signedBy: { select: { name: true } },
                approvedBy: { select: { name: true } }
            }
        });

        return NextResponse.json({ success: true, lifePlan });
    } catch (error) {
        console.error("GET PAI Error:", error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

// PUT — Crea o actualiza PAI. Si status → APPROVED: flujo completo de aprobación
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        const invokerRole = (session.user as any).role;
        const invokerUserId = (session.user as any).id;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });

        const resolvedParams = await params;
        const patientId = resolvedParams.id;
        const body = await req.json();
        if (!patientId) return NextResponse.json({ success: false, error: 'Patient ID missing' }, { status: 400 });

        if (!(await assertTenantAccess(patientId, hqId))) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        const {
            id: existingId, // ID de un PAI existente a actualizar
            type,
            supportSource, clinicalSummary, continence, cognitiveLevel, mobility, dietDetails,
            risks, interdisciplinarySummary, goals, familyEducation, preferences,
            monitoringMethod, revisionCriteria, recommendedServices,
            signedById, status, startDate, nextReview,
            familyVersion: bodyFamilyVersion,
        } = body;

        const isApproving = status === 'APPROVED';
        const approvedById = isApproving ? (invokerUserId) : undefined;
        const approvedAt = isApproving ? new Date() : undefined;

        const paiData = {
            patientId,
            type: type || 'INITIAL',
            supportSource, clinicalSummary, continence, cognitiveLevel, mobility, dietDetails,
            risks, interdisciplinarySummary, goals, familyEducation, preferences,
            monitoringMethod, revisionCriteria, recommendedServices,
            signedById: signedById || null,
            signedAt: signedById ? new Date() : null,
            status: status || 'DRAFT',
            startDate: startDate ? new Date(startDate) : null,
            nextReview: nextReview ? new Date(nextReview) : null,
            familyVersion: bodyFamilyVersion || null,
            approvedById: approvedById || null,
            approvedAt: approvedAt || null,
        };

        let lifePlan: any;

        if (existingId) {
            // Actualizar PAI existente
            lifePlan = await prisma.lifePlan.update({
                where: { id: existingId },
                data: paiData
            });
        } else {
            // Crear nuevo PAI
            lifePlan = await prisma.lifePlan.create({ data: paiData });
        }

        // ── Flujo de aprobación ───────────────────────────────────────────────
        if (isApproving && bodyFamilyVersion) {
            try {
                // Notificación in-app al aprobador
                await notifyUser(invokerUserId, {
                    type: 'EMAR_ALERT',
                    title: 'PAI Aprobado',
                    message: `Plan Asistencial aprobado exitosamente.`,
                    link: `/corporate/medical/patients/${patientId}/pai`,
                });
            } catch { /* silenciar */ }

            // Enviar versión familiar por email
            try {
                const patient = await prisma.patient.findUnique({
                    where: { id: patientId },
                    include: {
                        primaryFamilyMember: { select: { name: true, email: true } },
                        headquarters: { select: { name: true, logoUrl: true } }
                    }
                });

                const familyEmail = (patient as any)?.primaryFamilyMember?.email;
                const familyName = (patient as any)?.primaryFamilyMember?.name;
                const hqName = (patient as any)?.headquarters?.name || 'Zéndity';
                const logoUrl = (patient as any)?.headquarters?.logoUrl;

                if (familyEmail) {
                    const logoHtml = logoUrl
                        ? `<img src="${logoUrl}" alt="${hqName}" style="max-height:60px;object-fit:contain;margin-bottom:12px;" />`
                        : '';

                    const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#f8fafc;">
    <div style="background:#0f172a;padding:28px 32px;text-align:center;">
        ${logoHtml}
        <h1 style="color:#fff;margin:0;font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:2px;">${hqName}</h1>
        <p style="color:#64748b;font-size:11px;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;">Plan de Atención Individualizado</p>
    </div>
    <div style="padding:32px;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0;font-weight:900;color:#15803d;font-size:16px;">✅ Plan de Atención Aprobado</p>
            <p style="margin:4px 0 0;color:#166534;font-size:13px;">
                Estimado(a) <strong>${familyName || 'Familiar'}</strong>, el equipo clínico de ${hqName} ha aprobado el Plan de Atención de <strong>${patient?.name}</strong>.
            </p>
        </div>

        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:24px;white-space:pre-wrap;font-size:14px;color:#334155;line-height:1.7;">
${bodyFamilyVersion}
        </div>

        <p style="margin-top:24px;font-size:13px;color:#94a3b8;">
            Puede ver el historial completo de planes en el portal familiar:
            <a href="https://app.zendity.com/family/pai" style="color:#0f6b78;">app.zendity.com/family/pai</a>
        </p>
    </div>
    <div style="background:#f1f5f9;padding:16px 32px;text-align:center;font-size:11px;color:#94a3b8;">
        Enviado automáticamente por Zéndity OS — ${hqName}
    </div>
</div>`;

                    await sgMail.send({
                        to: familyEmail,
                        from: {
                            email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                            name: hqName
                        },
                        subject: `Plan de Atención de ${patient?.name} — Aprobado`,
                        html: emailHtml,
                    });

                    // Marcar emailSentAt
                    await prisma.lifePlan.update({
                        where: { id: lifePlan.id },
                        data: { emailSentAt: new Date() }
                    });

                    lifePlan.emailSentAt = new Date();
                }
            } catch (sgErr) {
                console.error('SendGrid PAI email error:', sgErr);
            }
        }

        return NextResponse.json({ success: true, lifePlan, emailSent: isApproving && !!body.familyVersion });
    } catch (error) {
        console.error("PUT PAI Error:", error);
        return NextResponse.json({ success: false, error: 'Fallo al guardar el Plan Asistencial' }, { status: 500 });
    }
}
