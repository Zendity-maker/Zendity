import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const resolvedParams = await context.params;
        const invoiceId = resolvedParams.id;
        const directorId = (session.user as any).id;

        const body = await req.json().catch(() => ({}));
        const {
            paymentMethod,
            paidAt,
            referenceNumber,
            amount,
        } = body;

        // Obtener la factura con residente y familiar primario
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                patient: {
                    select: {
                        id: true, name: true, roomNumber: true,
                        primaryFamilyMember: { select: { name: true, email: true } },
                    }
                },
                headquarters: { select: { name: true, logoUrl: true } },
                items: true,
            }
        }) as any;

        if (!invoice) {
            return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
        }

        const paidDate = paidAt ? new Date(paidAt) : new Date();
        const paidAmount = amount ? parseFloat(amount) : invoice.totalAmount;

        // 1. Actualizar Invoice
        const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'PAID',
                paidAt: paidDate,
                paymentMethod: paymentMethod || null,
                referenceNumber: referenceNumber || null,
                amountPaid: paidAmount,
                updatedAt: new Date(),
            }
        });

        // 2. Crear InvoicePayment
        await prisma.invoicePayment.create({
            data: {
                invoiceId,
                amount: paidAmount,
                source: paymentMethod === 'ADF' ? 'ADF' : 'PRIVATE',
                date: paidDate,
                notes: referenceNumber ? `Ref: ${referenceNumber} | Método: ${paymentMethod || 'N/A'}` : (paymentMethod || null),
            }
        });

        // 3. Notificar al DIRECTOR in-app
        try {
            await notifyUser(directorId, {
                type: 'EMAR_ALERT',
                title: 'Pago registrado',
                message: `${invoice.patient?.name} — $${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} — ${paymentMethod || 'Sin método'}`,
                link: '/corporate/billing',
            });
        } catch { /* silenciar */ }

        // 4. Enviar recibo por email al familiar primario
        const familyEmail = (invoice.patient as any)?.primaryFamilyMember?.email;
        const familyName = (invoice.patient as any)?.primaryFamilyMember?.name;
        const hqName = invoice.headquarters?.name || 'Vivid Senior Living';
        const logoUrl = invoice.headquarters?.logoUrl;

        if (familyEmail) {
            try {
                const logoHtml = logoUrl
                    ? `<img src="${logoUrl}" alt="${hqName}" style="max-height:60px;object-fit:contain;margin-bottom:12px;" />`
                    : '';
                const monthYear = paidDate.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' });
                const itemsHtml = invoice.items.map((item: any) =>
                    `<tr><td style="padding:8px 0;color:#475569;">${item.description}</td><td style="padding:8px 0;text-align:right;font-weight:bold;">$${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>`
                ).join('');

                const receiptHtml = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#f8fafc;">
                    <div style="background:#0f172a;padding:28px 32px;text-align:center;">
                        ${logoHtml}
                        <h1 style="color:#fff;margin:0;font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:2px;">${hqName}</h1>
                        <p style="color:#64748b;font-size:11px;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;">Recibo de Pago Oficial</p>
                    </div>
                    <div style="padding:32px;">
                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
                            <span style="font-size:24px;">✅</span>
                            <div>
                                <p style="margin:0;font-weight:900;color:#15803d;font-size:16px;">Pago Confirmado</p>
                                <p style="margin:2px 0 0;color:#166534;font-size:13px;">${paidDate.toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>

                        <p style="color:#475569;font-size:15px;">Estimado(a) <strong>${familyName || 'Familiar'}</strong>,</p>
                        <p style="color:#475569;font-size:14px;line-height:1.6;">Confirmamos la recepción del pago correspondiente a <strong>${invoice.patient?.name}</strong> — ${monthYear}.</p>

                        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                            <thead>
                                <tr style="border-bottom:2px solid #1e293b;">
                                    <th style="text-align:left;padding:10px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Concepto</th>
                                    <th style="text-align:right;padding:10px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Monto</th>
                                </tr>
                            </thead>
                            <tbody>${itemsHtml}</tbody>
                            <tfoot>
                                <tr style="border-top:2px solid #1e293b;">
                                    <td style="padding:12px 0;font-weight:900;color:#0f172a;font-size:16px;">Total Pagado</td>
                                    <td style="padding:12px 0;text-align:right;font-weight:900;color:#15803d;font-size:20px;">$${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <table style="width:100%;font-size:13px;color:#64748b;">
                            ${paymentMethod ? `<tr><td style="padding:4px 0;font-weight:bold;">Método:</td><td>${paymentMethod}</td></tr>` : ''}
                            ${referenceNumber ? `<tr><td style="padding:4px 0;font-weight:bold;">Referencia:</td><td>${referenceNumber}</td></tr>` : ''}
                            <tr><td style="padding:4px 0;font-weight:bold;">Factura #:</td><td>${invoice.invoiceNumber}</td></tr>
                            <tr><td style="padding:4px 0;font-weight:bold;">Cuarto:</td><td>${invoice.patient?.roomNumber || 'N/A'}</td></tr>
                        </table>

                        <p style="margin-top:24px;font-size:13px;color:#94a3b8;">Puede acceder al portal familiar en <a href="https://app.zendity.com/family" style="color:#0f6b78;">app.zendity.com/family</a> para ver el historial de pagos.</p>
                    </div>
                    <div style="background:#f1f5f9;padding:16px 32px;text-align:center;font-size:11px;color:#94a3b8;">
                        Recibo emitido automáticamente por Zéndity OS — ${hqName}
                    </div>
                </div>`;

                await sgMail.send({
                    to: familyEmail,
                    from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: hqName },
                    subject: `Recibo de pago — ${invoice.patient?.name} — ${monthYear}`,
                    html: receiptHtml,
                });

                // Marcar receiptSentAt
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { receiptSentAt: new Date() }
                });

            } catch (sgErr) {
                console.error('SendGrid receipt error:', sgErr);
            }
        }

        return NextResponse.json({
            success: true,
            invoice: updated,
            receiptSent: !!familyEmail,
        });

    } catch (error: any) {
        console.error('Pay Invoice Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Error procesando pago' }, { status: 500 });
    }
}
