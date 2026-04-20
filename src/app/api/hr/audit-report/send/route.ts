import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import sgMail from '@sendgrid/mail';

export const dynamic = 'force-dynamic';

const SEND_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function extractSummary(aiReport: string): string {
    // Primer párrafo después de "## Resumen Ejecutivo"
    const match = aiReport.match(/##\s*Resumen Ejecutivo\s*\n+([\s\S]*?)(?=\n##|\n\[|$)/i);
    const raw = (match?.[1] || aiReport.split('\n\n')[0] || '').trim();
    // Strip markdown simple: **bold**, *em*, listas
    return raw
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/^[-*]\s+/gm, '')
        .trim();
}

function extractRecommendation(aiReport: string): { label: string; color: string; bg: string } {
    const m = aiReport.match(/\[(DESTACADO|SATISFACTORIO|EN DESARROLLO|ACCIÓN REQUERIDA)\]/i);
    const val = m?.[1]?.toUpperCase() || '';
    if (val === 'DESTACADO') return { label: 'DESTACADO', color: '#065F46', bg: '#D1FAE5' };
    if (val === 'SATISFACTORIO') return { label: 'SATISFACTORIO', color: '#0F6E56', bg: '#E1F5EE' };
    if (val === 'EN DESARROLLO') return { label: 'EN DESARROLLO', color: '#92400E', bg: '#FEF3C7' };
    if (val === 'ACCIÓN REQUERIDA') return { label: 'ACCIÓN REQUERIDA', color: '#991B1B', bg: '#FEE2E2' };
    return { label: 'EN REVISIÓN', color: '#475569', bg: '#F1F5F9' };
}

function formatDate(d: Date): string {
    return d.toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!SEND_ROLES.includes(session.user.role)) {
            return NextResponse.json({ success: false, error: 'Rol sin permiso' }, { status: 403 });
        }

        const hqId = session.user.headquartersId;
        const body = await req.json();
        const { performanceScoreId } = body as { performanceScoreId?: string };

        if (!performanceScoreId) {
            return NextResponse.json({ success: false, error: 'performanceScoreId requerido' }, { status: 400 });
        }

        const score = await prisma.performanceScore.findFirst({
            where: { id: performanceScoreId, headquartersId: hqId },
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                headquarters: { select: { name: true } },
            },
        });

        if (!score) {
            return NextResponse.json({ success: false, error: 'Auditoría no encontrada' }, { status: 404 });
        }
        if (!score.user.email) {
            return NextResponse.json({ success: false, error: 'El empleado no tiene email registrado' }, { status: 400 });
        }
        if (!score.aiReport) {
            return NextResponse.json({ success: false, error: 'Esta auditoría no tiene informe generado' }, { status: 400 });
        }

        if (!process.env.SENDGRID_API_KEY) {
            return NextResponse.json({ success: false, error: 'SendGrid no configurado en este entorno' }, { status: 500 });
        }

        const summary = extractSummary(score.aiReport);
        const reco = extractRecommendation(score.aiReport);
        const finalScore = score.finalScore ?? score.systemScore;
        const hqName = score.headquarters.name || 'Zéndity';
        const sentAt = new Date();

        const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <div style="max-width:600px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="background:#0F6B78;padding:28px 32px;color:#FFFFFF;">
      <div style="font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;opacity:0.85;">Zéndity Healthcare</div>
      <div style="font-size:22px;font-weight:900;margin-top:4px;">Informe de Desempeño</div>
    </div>

    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Estimado/a <strong>${score.user.name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">
        A continuación encontrará su informe de desempeño correspondiente al período del
        <strong>${formatDate(score.periodStart)}</strong> al <strong>${formatDate(score.periodEnd)}</strong>.
      </p>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;">
          <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;">Score actual</div>
          <div style="font-size:28px;font-weight:900;color:#0F172A;margin-top:4px;">${Math.round(finalScore)}<span style="font-size:14px;color:#94A3B8;font-weight:700;">/100</span></div>
        </div>
        <div style="flex:1;background:${reco.bg};border:1px solid ${reco.bg};border-radius:10px;padding:16px;">
          <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${reco.color};opacity:0.8;">Recomendación</div>
          <div style="font-size:14px;font-weight:900;color:${reco.color};margin-top:6px;letter-spacing:1px;">${reco.label}</div>
        </div>
      </div>

      <div style="border-top:1px solid #E2E8F0;padding-top:20px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#0F6B78;margin-bottom:10px;">Resumen Ejecutivo</div>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#1E293B;white-space:pre-wrap;">${summary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>

      ${score.feedback ? `
      <div style="border-top:1px solid #E2E8F0;padding-top:20px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#0F6B78;margin-bottom:10px;">Observaciones del Director</div>
        <div style="background:#F8FAFC;border-left:3px solid #0F6B78;padding:14px 16px;border-radius:4px;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">${score.feedback.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
      ` : ''}

      <div style="border-top:1px solid #E2E8F0;padding-top:16px;font-size:12px;color:#64748B;line-height:1.6;">
        Si tiene alguna pregunta sobre este informe, puede coordinar una reunión con su supervisor inmediato.
      </div>
    </div>

    <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #E2E8F0;">
      <p style="margin:0 0 4px;color:#64748B;font-size:11px;">Este informe fue generado por Zéndity. ${hqName}.</p>
      <p style="margin:0;color:#94A3B8;font-size:11px;">Enviado el ${sentAt.toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' })} · ${sentAt.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
  </div>
</body>
</html>`;

        await sgMail.send({
            to: score.user.email,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                name: `${hqName} via Zéndity`,
            },
            subject: `Informe de Desempeño — Zéndity · ${score.user.name} · ${formatDate(sentAt)}`,
            html,
        });

        await prisma.systemAuditLog.create({
            data: {
                headquartersId: hqId,
                entityName: 'PerformanceScore',
                entityId: performanceScoreId,
                action: 'AUDIT_REPORT_SENT',
                performedById: session.user.id,
                payloadChanges: {
                    employeeId: score.user.id,
                    employeeEmail: score.user.email,
                    performanceScoreId,
                    sentAt: sentAt.toISOString(),
                } as any,
            },
        });

        return NextResponse.json({
            success: true,
            sentTo: score.user.email,
            sentAt: sentAt.toISOString(),
        });
    } catch (error: any) {
        console.error('audit-report/send error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error enviando el informe',
        }, { status: 500 });
    }
}
