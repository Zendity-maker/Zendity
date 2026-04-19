import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyUser } from '@/lib/notifications';
import { IncidentStatus, HrIncidentSeverity } from '@prisma/client';
import sgMail from '@sendgrid/mail';

export const dynamic = 'force-dynamic';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const DIRECTOR_ROLES = ['DIRECTOR', 'ADMIN'];

function pointsFor(severity: HrIncidentSeverity): { delta: number; setToZero: boolean } {
    switch (severity) {
        case 'OBSERVATION': return { delta: 0, setToZero: false };
        case 'WARNING': return { delta: -5, setToZero: false };
        case 'SUSPENSION': return { delta: -15, setToZero: false };
        case 'TERMINATION': return { delta: 0, setToZero: true };
        default: return { delta: 0, setToZero: false };
    }
}

function severityLabel(sev: HrIncidentSeverity): string {
    return sev === 'OBSERVATION' ? 'Observación' :
           sev === 'WARNING' ? 'Amonestación Escrita' :
           sev === 'SUSPENSION' ? 'Suspensión Temporal' :
           sev === 'TERMINATION' ? 'Despido Justificado' : String(sev);
}

function categoryLabel(cat: string): string {
    const map: Record<string, string> = {
        PUNCTUALITY: 'Puntualidad',
        PATIENT_CARE: 'Cuidado del Residente',
        HYGIENE: 'Higiene',
        BEHAVIOR: 'Conducta',
        DOCUMENTATION: 'Documentación',
        UNIFORM: 'Uniforme',
        OTHER: 'Otro',
    };
    return map[cat] || cat;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;

        if (!DIRECTOR_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Solo el Director puede decidir sobre observaciones' }, { status: 403 });
        }

        const { action, directorNote } = await req.json();
        if (!action || !['REQUEST_EXPLANATION', 'APPLY', 'DISMISS'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 });
        }

        const incident = await prisma.incidentReport.findUnique({
            where: { id },
            include: {
                employee: { select: { id: true, name: true, email: true, complianceScore: true } },
                hq: { select: { name: true, logoUrl: true } }
            }
        });

        if (!incident) {
            return NextResponse.json({ success: false, error: 'Observación no encontrada' }, { status: 404 });
        }
        if (incident.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Tenant mismatch' }, { status: 403 });
        }

        const now = new Date();

        // ── REQUEST_EXPLANATION ──
        if (action === 'REQUEST_EXPLANATION') {
            const updated = await prisma.incidentReport.update({
                where: { id },
                data: {
                    status: IncidentStatus.PENDING_EXPLANATION,
                    visibleToEmployee: true,
                    directorNote: directorNote || incident.directorNote || null,
                }
            });

            await notifyUser(incident.employeeId, {
                type: 'EMAR_ALERT',
                title: 'Observación pendiente de respuesta',
                message: 'El director solicita tu explicación. Tienes 48 horas para responder.'
            });

            return NextResponse.json({ success: true, incident: updated });
        }

        // ── DISMISS ──
        if (action === 'DISMISS') {
            const updated = await prisma.incidentReport.update({
                where: { id },
                data: {
                    status: IncidentStatus.DISMISSED,
                    dismissedAt: now,
                    directorNote: directorNote || incident.directorNote || null,
                }
            });
            return NextResponse.json({ success: true, incident: updated });
        }

        // ── APPLY ──
        // Calcular puntos y nuevo complianceScore
        const { delta, setToZero } = pointsFor(incident.severity);
        const currentScore = incident.employee?.complianceScore ?? 50;
        const newScore = setToZero ? 0 : Math.max(0, currentScore + delta);
        const pointsDeductedAbs = setToZero ? currentScore : Math.abs(delta);

        const [updated] = await prisma.$transaction([
            prisma.incidentReport.update({
                where: { id },
                data: {
                    status: IncidentStatus.APPLIED,
                    appliedAt: now,
                    visibleToEmployee: true,
                    pointsDeducted: pointsDeductedAbs,
                    directorNote: directorNote || incident.directorNote || null,
                }
            }),
            prisma.user.update({
                where: { id: incident.employeeId },
                data: { complianceScore: newScore }
            })
        ]);

        // Notificación in-app
        await notifyUser(incident.employeeId, {
            type: 'EMAR_ALERT',
            title: 'Observación aplicada',
            message: `Se aplicó una ${severityLabel(incident.severity)}. Puntos deducidos: ${pointsDeductedAbs}. Revisa el detalle.`
        });

        // Email SendGrid
        if (incident.employee?.email && process.env.SENDGRID_API_KEY) {
            try {
                const hqName = incident.hq?.name || 'Zéndity';
                const logoHtml = incident.hq?.logoUrl
                    ? `<img src="${incident.hq.logoUrl}" alt="${hqName}" style="max-height:72px;margin-bottom:16px;object-fit:contain;" />`
                    : '';
                const sigHtml = incident.signatureBase64
                    ? `<img src="${incident.signatureBase64}" alt="Firma" style="max-height:80px;border-top:1px solid #cbd5e1;padding-top:6px;" />`
                    : '<em style="color:#64748b;">Firma digital registrada en el sistema.</em>';

                const emailHtml = `
                <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;padding:28px;color:#0f172a;">
                    <div style="text-align:center;border-bottom:2px solid #0f6b78;padding-bottom:16px;margin-bottom:24px;">
                        ${logoHtml}
                        <div style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#1e293b;">Observación Formal — ${hqName}</div>
                    </div>
                    <div style="background:#ffffff;padding:24px;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.05);line-height:1.6;font-size:15px;">
                        <h3 style="color:#9f1239;margin:0 0 12px 0;font-size:20px;">Observación formal — Zéndity</h3>
                        <p>Estimado(a) <strong>${incident.employee.name}</strong>,</p>
                        <p>Con fecha <strong>${now.toLocaleDateString('es-PR')}</strong>, la dirección de ${hqName} ha aplicado una observación formal en tu expediente.</p>
                        <table style="width:100%;border-collapse:collapse;margin:18px 0;">
                            <tr><td style="padding:6px 0;color:#64748b;font-weight:bold;">Categoría:</td><td>${categoryLabel(incident.category)}</td></tr>
                            <tr><td style="padding:6px 0;color:#64748b;font-weight:bold;">Severidad:</td><td><strong style="color:#b91c1c;">${severityLabel(incident.severity)}</strong></td></tr>
                            <tr><td style="padding:6px 0;color:#64748b;font-weight:bold;">Puntos deducidos:</td><td>${pointsDeductedAbs}</td></tr>
                            <tr><td style="padding:6px 0;color:#64748b;font-weight:bold;">Score actual:</td><td>${newScore} / 100</td></tr>
                        </table>
                        <div style="background:#fff1f2;border-left:4px solid #f43f5e;padding:14px;margin:16px 0;">
                            <div style="font-size:11px;font-weight:bold;color:#9f1239;text-transform:uppercase;margin-bottom:4px;">Descripción</div>
                            <div style="white-space:pre-wrap;">${incident.description.replace(/</g, '&lt;')}</div>
                        </div>
                        ${incident.directorNote ? `
                        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px;margin:16px 0;">
                            <div style="font-size:11px;font-weight:bold;color:#1d4ed8;text-transform:uppercase;margin-bottom:4px;">Nota del Director</div>
                            <div style="white-space:pre-wrap;">${incident.directorNote.replace(/</g, '&lt;')}</div>
                        </div>` : ''}
                        <div style="margin-top:24px;border-top:1px dashed #cbd5e1;padding-top:16px;">
                            <p style="margin:0 0 6px 0;font-weight:bold;color:#0f6b78;">Firma digital del supervisor:</p>
                            ${sigHtml}
                        </div>
                        <p style="margin-top:20px;font-size:13px;color:#64748b;">Puedes ingresar al portal Zéndity para leer el detalle completo y apelar esta observación si consideras que procede.</p>
                    </div>
                    <div style="text-align:center;margin-top:20px;font-size:11px;color:#64748b;">Mensaje automático emitido por Zéndity OS.</div>
                </div>`;

                await sgMail.send({
                    to: incident.employee.email,
                    from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: hqName },
                    subject: `Observación formal — ${hqName}`,
                    html: emailHtml
                });
            } catch (sgError) {
                console.error("SendGrid email failed:", sgError);
            }
        }

        return NextResponse.json({
            success: true,
            incident: updated,
            newComplianceScore: newScore,
            pointsDeducted: pointsDeductedAbs
        });

    } catch (error: any) {
        console.error("Error deciding HR incident:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
