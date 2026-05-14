import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';
import { z } from 'zod';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const ALLOWED_ROLES_READ = ['CLEANING', 'MAINTENANCE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];
const ALLOWED_ROLES_CREATE = ['ADMIN', 'DIRECTOR', 'SUPERVISOR', 'NURSE'];
const ALLOWED_ROLES_UPDATE = ['CLEANING', 'MAINTENANCE'];

const CreateSchema = z.object({
    areaName: z.string().min(1).max(120),
    description: z.string().min(1).max(1000),
    photoUrl: z.string().nullable().optional(),
    priority: z.enum(['NORMAL', 'URGENT']).optional(),
    areaId: z.string().uuid().nullable().optional(),
});

const PatchSchema = z.object({
    requestId: z.string().uuid(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED']),
});

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_READ.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Sesión sin sede asignada' }, { status: 400 });
        }

        // Auto-expire ahora vive en /api/cron/expire-cleaning-requests (cada 5 min).
        // GET es idempotente — no genera writes.
        const requests = await prisma.cleaningRequest.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            include: {
                requestedBy: { select: { id: true, name: true, role: true } },
                assignedTo: { select: { id: true, name: true } },
                area: { select: { id: true, name: true, category: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, requests });
    } catch (error) {
        console.error('Cleaning Requests GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando solicitudes' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_CREATE.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = CreateSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Datos inválidos', issues: parsed.error.issues },
                { status: 400 }
            );
        }
        const { areaName, description, photoUrl, priority, areaId } = parsed.data;

        const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes SLA
        const hqId = (session.user as any).headquartersId;
        const isUrgent = priority === 'URGENT';

        const request = await prisma.cleaningRequest.create({
            data: {
                headquartersId: hqId,
                requestedById: session.user.id,
                areaId: areaId || null,
                areaName,
                description,
                photoUrl: photoUrl || null,
                priority: priority || 'NORMAL',
                expiresAt,
            },
            include: {
                requestedBy: { select: { id: true, name: true, role: true } },
                area: { select: { id: true, name: true, category: true } },
            },
        });

        // Notificar al personal de limpieza/mantenimiento de la sede.
        // El SLA de 45 min es ficticio si no avisamos: la UI solo hace polling cada 60s.
        try {
            const recipients = await prisma.user.findMany({
                where: {
                    headquartersId: hqId,
                    role: { in: ['CLEANING', 'MAINTENANCE'] },
                    isActive: true,
                    isDeleted: false,
                },
                select: { id: true, email: true, name: true },
            });

            if (recipients.length > 0) {
                await prisma.notification.createMany({
                    data: recipients.map(r => ({
                        userId: r.id,
                        type: 'CLEANING_REQUEST',
                        title: isUrgent ? '🚨 Limpieza urgente' : 'Nueva solicitud de limpieza',
                        message: `${areaName}: ${description}`,
                        isRead: false,
                    })),
                });

                // Email solo en URGENT — para no saturar al equipo con notificaciones normales
                if (isUrgent && process.env.SENDGRID_API_KEY) {
                    const requesterName = (request.requestedBy as any)?.name || 'Personal';
                    const emails = recipients.map(r => r.email).filter(Boolean);
                    if (emails.length > 0) {
                        await Promise.all(
                            emails.map(email =>
                                sgMail.send({
                                    to: email,
                                    from: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                                    subject: `🚨 Limpieza urgente: ${areaName}`,
                                    html: `
                                        <div style="font-family: system-ui, sans-serif; max-width: 480px;">
                                            <h2 style="color: #0F6E56; margin-bottom: 4px;">Solicitud urgente de limpieza</h2>
                                            <p style="color: #64748b; margin: 0 0 16px;">SLA: 45 minutos</p>
                                            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444;">
                                                <p style="margin: 0; font-weight: 600; color: #0F6E56;">${areaName}</p>
                                                <p style="margin: 8px 0 0; color: #334155;">${description}</p>
                                            </div>
                                            <p style="color: #64748b; font-size: 13px; margin-top: 16px;">
                                                Solicitado por ${requesterName}. Abre Zéndity para tomar la solicitud.
                                            </p>
                                        </div>
                                    `,
                                }).catch(err => console.error('[CLEANING_REQUEST] Email fallido:', err))
                            )
                        );
                    }
                }
            }
        } catch (notifErr) {
            // No bloquear la creación si la notificación falla
            console.error('[CLEANING_REQUEST] Notificación fallida:', notifErr);
        }

        return NextResponse.json({ success: true, request });
    } catch (error) {
        console.error('Cleaning Requests POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error creando solicitud' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_UPDATE.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = PatchSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Datos inválidos', issues: parsed.error.issues },
                { status: 400 }
            );
        }
        const { requestId, status } = parsed.data;

        const hqId = (session.user as any).headquartersId;
        const existing = await prisma.cleaningRequest.findUnique({ where: { id: requestId } });
        if (!existing || existing.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 });
        }

        const updateData: any = { status };

        if (status === 'IN_PROGRESS') {
            updateData.assignedToId = session.user.id;
        }

        if (status === 'COMPLETED') {
            updateData.completedAt = new Date();
            updateData.assignedToId = existing.assignedToId || session.user.id;
        }

        const updated = await prisma.cleaningRequest.update({
            where: { id: requestId },
            data: updateData,
            include: {
                requestedBy: { select: { id: true, name: true, role: true } },
                assignedTo: { select: { id: true, name: true } },
                area: { select: { id: true, name: true, category: true } },
            },
        });

        return NextResponse.json({ success: true, request: updated });
    } catch (error) {
        console.error('Cleaning Requests PATCH Error:', error);
        return NextResponse.json({ success: false, error: 'Error actualizando solicitud' }, { status: 500 });
    }
}
