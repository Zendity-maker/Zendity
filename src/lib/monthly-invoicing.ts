import { prisma } from '@/lib/prisma';
import { getBillableResidents } from '@/lib/billable-residents';
import { calculateMonthlyCharge } from '@/lib/proration';
import { applyCreditsToInvoice } from '@/lib/patient-credits';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/** Plazo mínimo cuando la factura se emite después de su fecha nominal de vencimiento. */
const GRACE_DAYS_LATE_ISSUE = 5;

const MONTH_LABELS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Resultado de la generación mensual.
 */
export interface MonthlyInvoicingResult {
    hqId: string;
    year: number;
    month: number; // 0-11
    eligiblePatients: number;
    created: number;
    skippedExisting: number;
    skippedNoFee: number;
    /** Cuántas de las creadas salieron prorrateadas por ingreso a mitad de mes. */
    proratedCount: number;
    /** Facturas a las que se les aplicó saldo a favor, y monto total aplicado. */
    creditsAppliedCount: number;
    creditsAppliedAmount: number;
    emailsSent: number;
    invoiceIds: string[];
}

/**
 * Genera facturas mensuales para una sede.
 *
 * Reglas:
 *   - Pacientes facturables según BILLABLE_PATIENT_STATUSES (ACTIVE +
 *     TEMPORARY_LEAVE — el hospitalizado paga, la cama sigue reservada).
 *   - Solo si monthlyFee > 0 (los demás se cuentan en skippedNoFee).
 *   - Idempotente: si ya existe una Invoice de este mes para este paciente
 *     (rango issueDate del primer al último día del mes), se saltea.
 *   - dueDate = día 5 del mismo mes (configurable vía dueDay).
 *   - Prorrateo por días reales si el residente ingresó dentro del mes que se
 *     factura (ver `proration.ts`). El mes de egreso se cobra completo.
 *   - Crea 1 InvoiceItem: "Cuota mensual {Mes} {Año}" (o su variante
 *     prorrateada, que explica el cálculo en la propia descripción).
 *   - status: PENDING.
 *   - Si el familiar primario tiene email, le envía notificación
 *     "Tu factura del mes está disponible".
 *
 * Numeración: INV-{MMYYYY}-{NNN} secuencial DENTRO de la sede + mes.
 */
export async function generateMonthlyInvoicesForHq(opts: {
    hqId: string;
    year: number;
    month: number; // 0-11
    dueDay?: number; // default 5
    sendEmails?: boolean; // default true (cron); false en backfill
}): Promise<MonthlyInvoicingResult> {
    const { hqId, year, month, dueDay = 5, sendEmails = true } = opts;

    const firstOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const firstOfNextMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
    // dueDate = día `dueDay` del mes facturado. Pero desde que la reconciliación
    // corre a diario, una factura puede crearse el día 20 (alta a mitad de mes,
    // cuota cargada tarde); con el vencimiento fijo al día 5 nacería OVERDUE y
    // dispararía el cron de morosidad contra una familia que nunca recibió nada.
    // Si la fecha ya pasó, se le da un plazo mínimo desde hoy.
    const nominalDueDate = new Date(Date.UTC(year, month, dueDay, 23, 59, 59));
    const now = new Date();
    const dueDate = nominalDueDate > now
        ? nominalDueDate
        : new Date(now.getTime() + GRACE_DAYS_LATE_ISSUE * 24 * 3600 * 1000);
    const monthLabel = MONTH_LABELS_ES[month];
    const monthPrefix = `INV-${String(month + 1).padStart(2, '0')}${year}-`;

    // 1. Pacientes elegibles (facturables + monthlyFee>0)
    const allBillable = await getBillableResidents(hqId);
    const eligible = allBillable.filter(p => (p.monthlyFee || 0) > 0);
    const skippedNoFee = allBillable.length - eligible.length;

    // 2. Ya existen facturas de este mes (idempotencia)
    const existing = await prisma.invoice.findMany({
        where: {
            headquartersId: hqId,
            issueDate: { gte: firstOfMonth, lt: firstOfNextMonth },
        },
        select: { patientId: true, invoiceNumber: true },
    });
    const existingPatientIds = new Set(existing.map(e => e.patientId));
    // Numeración secuencial: continuar desde el N más alto encontrado del mes.
    const maxN = existing.reduce((max, e) => {
        const m = e.invoiceNumber.match(/-(\d+)$/);
        const n = m ? parseInt(m[1], 10) : 0;
        return n > max ? n : max;
    }, 0);

    const toCreate = eligible.filter(p => !existingPatientIds.has(p.id));

    const created: { id: string; patientId: string; patientName: string; settledByCredit: boolean }[] = [];
    let counter = maxN + 1;
    let proratedCount = 0;
    let creditsAppliedCount = 0;
    let creditsAppliedAmount = 0;

    for (const p of toCreate) {
        // Prorrateo del primer mes. admissionDate es la fuente correcta;
        // createdAt es el fallback mientras se puebla (los residentes legacy
        // se crearon todos el mismo día en la carga inicial, así que su
        // createdAt viejo nunca cae dentro del mes facturado y reciben cuota
        // completa — que es el resultado correcto).
        const charge = calculateMonthlyCharge({
            monthlyFee: p.monthlyFee,
            year,
            month,
            admissionDate: p.admissionDate ?? p.createdAt,
            status: p.status,
            monthLabel,
        });
        const subtotal = charge.amount;
        const invoiceNumber = `${monthPrefix}${String(counter).padStart(3, '0')}`;
        counter++;

        const inv = await prisma.invoice.create({
            data: {
                headquartersId: hqId,
                patientId: p.id,
                invoiceNumber,
                issueDate: firstOfMonth,
                dueDate,
                subtotal,
                taxRate: 0,
                totalAmount: subtotal,
                status: 'PENDING',
                notes: charge.description,
                items: {
                    create: [{
                        description: charge.description,
                        quantity: 1,
                        unitPrice: subtotal,
                        totalPrice: subtotal,
                    }],
                },
            },
        });
        if (charge.isProrated) proratedCount++;

        // Aplicar saldo a favor si el residente tiene (adelantos de meses
        // anteriores). La factura ya se emitió por el monto completo; el crédito
        // entra como InvoicePayment, que es lo que lo hace visible en reportes
        // de ingreso y emitible como recibo.
        let settledByCredit = false;
        try {
            const applied = await applyCreditsToInvoice({
                invoiceId: inv.id,
                patientId: p.id,
                totalAmount: subtotal,
            });
            if (applied.applied > 0) {
                creditsAppliedCount++;
                creditsAppliedAmount = Math.round((creditsAppliedAmount + applied.applied) * 100) / 100;
                settledByCredit = applied.remaining <= 0;
            }
        } catch (err) {
            // No abortamos la generación por un fallo al aplicar crédito: la
            // factura ya existe y es correcta. El saldo queda disponible para
            // aplicarse manualmente o en la siguiente corrida.
            console.error('[monthly-invoicing] fallo aplicando crédito', { patientId: p.id, err });
        }

        created.push({ id: inv.id, patientId: p.id, patientName: p.name, settledByCredit });
    }

    // 3. Email a familiar primario (best-effort, paralelo)
    let emailsSent = 0;
    if (sendEmails && created.length > 0 && process.env.SENDGRID_API_KEY) {
        const hq = await prisma.headquarters.findUnique({ where: { id: hqId }, select: { name: true } });
        const hqName = hq?.name || 'Zéndity';
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';
        const dueLabel = dueDate.toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico' });

        for (const inv of created) {
            // Si el saldo a favor cubrió la factura completa, no mandamos el
            // aviso de "tu factura está disponible": la familia ya pagó y
            // recibiría un correo pidiéndole plata que no debe.
            if (inv.settledByCredit) continue;
            try {
                const primaryFamily = await prisma.familyMember.findFirst({
                    where: {
                        patientId: inv.patientId,
                        isRegistered: true,
                        OR: [{ isPrimary: true }, {}],
                    },
                    orderBy: { isPrimary: 'desc' },
                    select: { name: true, email: true },
                });
                if (!primaryFamily?.email) continue;

                const invoice = await prisma.invoice.findUnique({
                    where: { id: inv.id },
                    select: { invoiceNumber: true, totalAmount: true },
                });
                if (!invoice) continue;

                await sgMail.send({
                    to: primaryFamily.email,
                    from: fromEmail,
                    subject: `Factura de ${monthLabel} ${year} — ${inv.patientName}`,
                    html: `<div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;padding:24px;">
                        <h2 style="color:#0F6E56;">Tu factura del mes está disponible</h2>
                        <p>Hola ${primaryFamily.name || ''},</p>
                        <p>La factura de <strong>${inv.patientName}</strong> para el mes de <strong>${monthLabel} ${year}</strong> está disponible en el portal familiar:</p>
                        <ul style="background:#F1F5F9;border-left:4px solid #0F6E56;padding:12px 24px;border-radius:0 8px 8px 0;">
                            <li>Número: <strong>${invoice.invoiceNumber}</strong></li>
                            <li>Total: <strong>$${invoice.totalAmount.toFixed(2)}</strong></li>
                            <li>Vence: <strong>${dueLabel}</strong></li>
                        </ul>
                        <p style="margin-top:16px;">
                            <a href="https://app.zendity.com/family/billing" style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver en el portal →</a>
                        </p>
                        <p style="color:#64748b;font-size:13px;margin-top:32px;">— ${hqName}</p>
                    </div>`,
                });
                emailsSent++;
            } catch {
                // best-effort, no rompemos la generación si un email falla
            }
        }
    }

    return {
        hqId,
        year,
        month,
        eligiblePatients: eligible.length,
        created: created.length,
        skippedExisting: eligible.length - toCreate.length,
        skippedNoFee,
        proratedCount,
        creditsAppliedCount,
        creditsAppliedAmount,
        emailsSent,
        invoiceIds: created.map(c => c.id),
    };
}
