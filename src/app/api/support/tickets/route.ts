import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logWarn } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'KITCHEN', 'MAINTENANCE'];

const CATEGORY_LABELS: Record<string, string> = {
    BUG: '🐛 Error del sistema',
    QUESTION: '❓ Pregunta',
    FEATURE: '💡 Solicitud de mejora',
    URGENT: '🚨 Urgente',
};

// ── POST /api/support/tickets ──────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { id: submittedById, headquartersId } = auth;

        const body = await req.json().catch(() => null);
        const { category = 'QUESTION', description } = body || {};

        if (!description || typeof description !== 'string' || description.trim().length < 10) {
            return NextResponse.json(
                { success: false, error: 'La descripción debe tener al menos 10 caracteres.' },
                { status: 400 }
            );
        }

        const validCategories = ['BUG', 'QUESTION', 'FEATURE', 'URGENT'];
        const safeCategory = validCategories.includes(category) ? category : 'QUESTION';

        const ticket = await prisma.supportTicket.create({
            data: {
                headquartersId,
                submittedById,
                category: safeCategory,
                description: description.trim(),
                status: 'OPEN',
            },
            include: {
                submittedBy: { select: { name: true, role: true, email: true } },
                headquarters: { select: { name: true } },
            },
        });

        // Notificar a soporte@zendity.com vía SendGrid (no-fatal)
        try {
            const sgMail = require('@sendgrid/mail');
            if (process.env.SENDGRID_API_KEY) {
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                await sgMail.send({
                    to: 'andrestyflores@gmail.com',
                    from: {
                        email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                        name: 'Zéndity Soporte',
                    },
                    subject: `[${safeCategory}] Nuevo ticket de soporte — ${ticket.headquarters.name}`,
                    html: `
                        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
                            <h2 style="color:#0f6e56;margin-bottom:4px;">Nuevo Ticket de Soporte</h2>
                            <p style="color:#64748b;font-size:13px;margin-top:0;">${new Date().toLocaleString('es-PR')}</p>
                            <hr style="border:1px solid #e2e8f0;margin:16px 0;">
                            <table style="width:100%;border-collapse:collapse;">
                                <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:140px;">Sede:</td><td style="padding:8px 0;font-weight:600;">${ticket.headquarters.name}</td></tr>
                                <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Reportado por:</td><td style="padding:8px 0;font-weight:600;">${ticket.submittedBy.name} (${ticket.submittedBy.role})</td></tr>
                                <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Email:</td><td style="padding:8px 0;">${ticket.submittedBy.email}</td></tr>
                                <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Categoría:</td><td style="padding:8px 0;">${CATEGORY_LABELS[safeCategory]}</td></tr>
                                <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Ticket ID:</td><td style="padding:8px 0;font-family:monospace;font-size:12px;">${ticket.id}</td></tr>
                            </table>
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
                                <p style="color:#64748b;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;">Descripción</p>
                                <p style="color:#1e293b;font-size:15px;line-height:1.6;margin:0;">${description.trim().replace(/\n/g, '<br>')}</p>
                            </div>
                            <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Zéndity · Sistema de Soporte Interno</p>
                        </div>
                    `,
                });
            }
        } catch (emailErr) {
            logWarn('support.tickets.email', emailErr, { ticketId: ticket.id });
        }

        return NextResponse.json({ success: true, ticket: { id: ticket.id, status: ticket.status } });
    } catch (error: any) {
        console.error('[SupportTicket POST]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// ── GET /api/support/tickets — lista tickets del usuario actual ───────────────
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const userId = (session.user as any).id;
        const role = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;

        // SUPER_ADMIN y DIRECTOR ven todos los tickets de su sede; otros solo los propios
        const where = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)
            ? { headquartersId: hqId }
            : { submittedById: userId };

        const tickets = await prisma.supportTicket.findMany({
            where,
            include: {
                submittedBy: { select: { name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return NextResponse.json({ success: true, tickets });
    } catch (error: any) {
        console.error('[SupportTicket GET]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
