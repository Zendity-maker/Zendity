import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolverFamiliarPrincipal } from '@/lib/familiar-principal';
import { avisoFamiliaSinPHI } from '@/lib/family-email';
import { requireRole } from '@/lib/api-auth';
import { notifyUser } from '@/lib/notifications';
import { emailLogoSrc } from '@/lib/email-logo';
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
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

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

        // Familiares reales del residente. La "fuente de apoyo principal" venia
        // siempre vacia porque nadie la prellenaba y la IA no la produce — y no
        // debe producirla: un nombre de familiar inventado en un documento que
        // se firma es peor que un campo en blanco. Sale del expediente o no sale.
        const familiares = await prisma.familyMember.findMany({
            where: { patientId, headquartersId: hqId },
            orderBy: { isPrimary: 'desc' },
            select: { name: true, relationship: true, isPrimary: true },
        });

        return NextResponse.json({ success: true, lifePlan, familiares });
    } catch (error) {
        console.error("GET PAI Error:", error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

// PUT — Crea o actualiza PAI. Si status → APPROVED: flujo completo de aprobación
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerUserId = auth.id;
        const hqId = auth.headquartersId;

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
                        primaryFamilyMember: { select: { id: true, name: true, email: true } },
                        familyMembers: { select: { id: true, name: true, email: true, isPrimary: true } },
                        headquarters: { select: { name: true, logoUrl: true } }
                    }
                });

                // Antes se leia primaryFamilyMember a secas. Ese campo solo se
                // llenaba si alguien marcaba una casilla, y casi nadie lo hacia:
                // 4 de 19 residentes con contacto. Aprobar el PAI de los otros 15
                // lo dejaba firmado y en silencio — le paso a Rosa M. Solis, cuya
                // hija tiene correo y cuenta activa y nunca se entero.
                //
                // Regla: el primero de la lista salvo que se marque otro.
                // Ver src/lib/familiar-principal.ts.
                const principal = resolverFamiliarPrincipal(
                    (patient as any)?.familyMembers ?? [],
                    (patient as any)?.primaryFamilyMemberId,
                );
                const familyEmail = principal?.email;
                const familyName = principal?.name;
                const hqName = (patient as any)?.headquarters?.name || 'Zéndity';
                const logoUrl = emailLogoSrc((patient as any)?.headquartersId, (patient as any)?.headquarters?.logoUrl);

                if (familyEmail) {
                    const logoHtml = logoUrl
                        ? `<img src="${logoUrl}" alt="${hqName}" style="max-height:60px;object-fit:contain;margin-bottom:12px;" />`
                        : '';

                    // El plan de atención NO se envía por correo. Es el documento
                    // clínico más completo del residente —diagnósticos, medicación,
                    // indicaciones— e iba entero en el cuerpo. El asunto además
                    // revelaba que esa persona está bajo plan clínico sin necesidad
                    // de abrirlo. Ver src/lib/family-email.ts.
                    const aviso = avisoFamiliaSinPHI({
                        familyName,
                        hqName,
                        titulo: 'Plan de atención aprobado',
                        detalle: 'El equipo clínico aprobó una actualización del plan de atención. Puede leerlo completo en el portal familiar.',
                        ruta: '/family/pai',
                    });

                    await sgMail.send({
                        to: familyEmail,
                        from: {
                            email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                            name: hqName
                        },
                        subject: aviso.subject,
                        html: aviso.html,
                        text: aviso.text,
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
