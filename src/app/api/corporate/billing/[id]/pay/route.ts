import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { createPatientCredit } from '@/lib/patient-credits';
import { computePayment, round2 } from '@/lib/payment-math';
import { notifyUser } from '@/lib/notifications';
import { emailLogoSrc } from '@/lib/email-logo';
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
        // Tenant check HIPAA — la factura debe ser de tu sede (antes: pago + recibo
        // por email se podía disparar sobre una factura de otra sede por id).
        if (invoice.headquartersId !== (session.user as any).headquartersId) {
            return NextResponse.json({ success: false, error: 'Factura fuera de tu sede' }, { status: 403 });
        }

        const paidDate = paidAt ? new Date(paidAt) : new Date();

        // Sin `amount` explícito se salda el pendiente completo (comportamiento
        // histórico del botón "Marcar pagada"). Con monto, se trata como abono.
        const requested = amount !== undefined && amount !== null && amount !== ''
            ? parseFloat(amount)
            : null;
        if (requested !== null && !Number.isFinite(requested)) {
            return NextResponse.json({ success: false, error: 'Monto de pago inválido' }, { status: 400 });
        }

        const { paymentAmount: paidAmount, newAmountPaid, isFullySettled, overpaid } =
            computePayment({
                totalAmount: invoice.totalAmount,
                previouslyPaid: invoice.amountPaid || 0,
                requestedAmount: requested,
            });
        const previouslyPaid = invoice.amountPaid || 0;

        if (paidAmount <= 0) {
            return NextResponse.json({ success: false, error: 'El monto del pago debe ser mayor que cero' }, { status: 400 });
        }

        // 1. Actualizar Invoice.
        //    Antes marcaba PAID SIEMPRE, sin comparar contra el total: registrar
        //    $100 de una cuota de $3,000 daba la factura por saldada y la sacaba
        //    de pendientes. Así quedó INV-082026-018 en "$1 pagado / PAID", y así
        //    cualquier subcobro se volvía invisible.
        const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                ...(isFullySettled
                    ? { status: 'PAID' as const, paidAt: paidDate }
                    : {}),
                paymentMethod: paymentMethod || null,
                referenceNumber: referenceNumber || null,
                amountPaid: newAmountPaid,
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

        // 2a. Un sobrepago se convierte en saldo a favor en vez de evaporarse.
        //     Es el mismo mecanismo que resuelve los adelantos de cuota.
        if (overpaid > 0) {
            try {
                await createPatientCredit({
                    headquartersId: invoice.headquartersId,
                    patientId: invoice.patientId,
                    amount: overpaid,
                    receivedAt: paidDate,
                    source: 'OVERPAYMENT',
                    reason: `Excedente del pago de ${invoice.invoiceNumber}`,
                    createdById: directorId,
                });
            } catch (err) {
                console.error('[billing pay] fallo creando crédito por sobrepago', err);
            }
        }

        // 2b. Auditoría del cobro.
        await logAudit({
            headquartersId: invoice.headquartersId,
            performedById: directorId,
            action: 'STATE_CHANGED',
            entityName: 'Invoice',
            entityId: invoiceId,
            resourceName: `${invoice.invoiceNumber} — ${invoice.patient?.name ?? 'Sin residente'}`,
            payloadChanges: {
                operation: isFullySettled ? 'PAYMENT_RECORDED' : 'PARTIAL_PAYMENT_RECORDED',
                paymentAmount: paidAmount,
                amountPaid: { before: previouslyPaid, after: newAmountPaid },
                totalAmount: invoice.totalAmount,
                outstandingAfter: round2(Math.max(0, invoice.totalAmount - newAmountPaid)),
                overpaidToCredit: overpaid > 0 ? overpaid : undefined,
                status: { before: invoice.status, after: updated.status },
                paymentMethod: paymentMethod || null,
                referenceNumber: referenceNumber || null,
                paidAt: paidDate.toISOString(),
            },
            request: req,
        });

        // 3. Notificar al DIRECTOR in-app
        try {
            await notifyUser(directorId, {
                type: 'EMAR_ALERT',
                title: isFullySettled ? 'Pago registrado' : 'Abono parcial registrado',
                message: `${invoice.patient?.name} — $${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} — ${paymentMethod || 'Sin método'}${isFullySettled ? '' : ` — pendiente $${round2(invoice.totalAmount - newAmountPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}`,
                link: '/corporate/billing',
            });
        } catch { /* silenciar */ }

        // 4. Enviar recibo por email al familiar primario
        const familyEmail = (invoice.patient as any)?.primaryFamilyMember?.email;
        const familyName = (invoice.patient as any)?.primaryFamilyMember?.name;
        const hqName = invoice.headquarters?.name || 'Vivid Senior Living';
        const logoUrl = emailLogoSrc((invoice as any).headquartersId, invoice.headquarters?.logoUrl);

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
                        <p style="color:#64748b;font-size:11px;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;">${isFullySettled ? 'Recibo de Pago Oficial' : 'Comprobante de Abono'}</p>
                    </div>
                    <div style="padding:32px;">
                        <div style="background:${isFullySettled ? '#f0fdf4' : '#fffbeb'};border:1px solid ${isFullySettled ? '#bbf7d0' : '#fde68a'};border-radius:10px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
                            <span style="font-size:24px;">${isFullySettled ? '✅' : '🧾'}</span>
                            <div>
                                <p style="margin:0;font-weight:900;color:${isFullySettled ? '#15803d' : '#b45309'};font-size:16px;">${isFullySettled ? 'Pago Confirmado' : 'Abono Recibido'}</p>
                                <p style="margin:2px 0 0;color:${isFullySettled ? '#166534' : '#92400e'};font-size:13px;">${paidDate.toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>

                        <p style="color:#475569;font-size:15px;">Estimado(a) <strong>${familyName || 'Familiar'}</strong>,</p>
                        <p style="color:#475569;font-size:14px;line-height:1.6;">Confirmamos la recepción ${isFullySettled ? 'del pago' : 'de un abono'} correspondiente a <strong>${invoice.patient?.name}</strong> — ${monthYear}.</p>

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
                                    <td style="padding:12px 0;font-weight:900;color:#0f172a;font-size:16px;">${isFullySettled ? 'Total Pagado' : 'Abono Recibido'}</td>
                                    <td style="padding:12px 0;text-align:right;font-weight:900;color:#15803d;font-size:20px;">$${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                </tr>
                                ${!isFullySettled ? `
                                <tr>
                                    <td style="padding:8px 0;font-weight:900;color:#b45309;font-size:15px;">Saldo Pendiente</td>
                                    <td style="padding:8px 0;text-align:right;font-weight:900;color:#b45309;font-size:18px;">$${round2(invoice.totalAmount - newAmountPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                </tr>` : ''}
                                ${overpaid > 0 ? `
                                <tr>
                                    <td style="padding:8px 0;font-weight:900;color:#0f6b78;font-size:15px;">Saldo a Favor</td>
                                    <td style="padding:8px 0;text-align:right;font-weight:900;color:#0f6b78;font-size:18px;">$${overpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                </tr>` : ''}
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
                    subject: `${isFullySettled ? 'Recibo de pago' : 'Comprobante de abono'} — ${invoice.patient?.name} — ${monthYear}`,
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
            // La UI necesita distinguir abono de pago total para no decirle al
            // Director "factura pagada" cuando todavía hay saldo por cobrar.
            isFullySettled,
            amountPaid: newAmountPaid,
            outstanding: round2(Math.max(0, invoice.totalAmount - newAmountPaid)),
            overpaidToCredit: overpaid > 0 ? overpaid : null,
        });

    } catch (error: any) {
        console.error('Pay Invoice Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Error procesando pago' }, { status: 500 });
    }
}
