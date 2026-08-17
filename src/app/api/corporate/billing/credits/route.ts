import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { createPatientCredit, getAvailableCredits } from '@/lib/patient-credits';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

/**
 * GET  /api/corporate/billing/credits[?patientId=X]
 * POST /api/corporate/billing/credits
 *
 * Saldos a favor de residentes: adelantos de cuota, sobrepagos y ajustes.
 *
 * Existe para que un adelanto no se "resuelva" editando la factura a $0 —
 * que fue lo que pasó con INV-082026-018 y dejó $3,000 realmente cobrados
 * fuera de todo reporte. La factura se emite completa; el crédito la paga.
 *
 * Auth: DIRECTOR/ADMIN, con ownership por sede sobre el residente.
 */

export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const patientId = new URL(req.url).searchParams.get('patientId');

        if (patientId) {
            const patient = await prisma.patient.findFirst({
                where: { id: patientId, headquartersId: hqId },
                select: { id: true, name: true },
            });
            if (!patient) {
                return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });
            }
            const credits = await getAvailableCredits(patientId);
            return NextResponse.json({
                success: true,
                patient: { id: patient.id, name: patient.name.trim() },
                credits,
                balance: credits.reduce((s, c) => s + c.available, 0),
            });
        }

        // Sin patientId: todos los saldos vivos de la sede.
        const credits = await prisma.patientCredit.findMany({
            where: { headquartersId: hqId },
            orderBy: { receivedAt: 'desc' },
            select: {
                id: true, amount: true, appliedAmount: true, receivedAt: true,
                source: true, reason: true,
                patient: { select: { id: true, name: true, roomNumber: true } },
            },
        });
        const withAvailable = credits
            .map(c => ({ ...c, available: Math.round((c.amount - c.appliedAmount) * 100) / 100 }))
            .filter(c => c.available > 0);

        return NextResponse.json({
            success: true,
            credits: withAvailable,
            balance: withAvailable.reduce((s, c) => s + c.available, 0),
        });
    } catch (err: any) {
        logError('corporate.billing.credits.get', err);
        return NextResponse.json({ success: false, error: 'Error consultando saldos a favor' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const patientId = (body.patientId || '').toString();
        const amount = parseFloat(body.amount);
        const source = body.source ?? 'ADVANCE_PAYMENT';
        const reason = body.reason ? body.reason.toString().trim() : undefined;

        if (!patientId || !Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ success: false, error: 'patientId y amount (> 0) son requeridos' }, { status: 400 });
        }
        if (!['ADVANCE_PAYMENT', 'OVERPAYMENT', 'ADJUSTMENT'].includes(source)) {
            return NextResponse.json({ success: false, error: 'source inválido' }, { status: 400 });
        }

        // receivedAt es la fecha REAL en que entró el dinero. Se acepta del body
        // justamente porque un adelanto se registra después de haberse cobrado:
        // usar "ahora" perdería a qué mes correspondía.
        const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
        if (Number.isNaN(receivedAt.getTime())) {
            return NextResponse.json({ success: false, error: 'receivedAt inválido' }, { status: 400 });
        }

        // Ownership: nunca confiar en el patientId del body sin verificar sede.
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true, name: true },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });
        }

        const credit = await createPatientCredit({
            headquartersId: hqId,
            patientId,
            amount,
            receivedAt,
            source,
            reason,
            createdById: auth.id,
        });

        await logAudit({
            headquartersId: hqId,
            performedById: auth.id,
            action: 'CREATED',
            entityName: 'PatientCredit',
            entityId: credit.id,
            resourceName: `Saldo a favor $${amount} — ${patient.name.trim()}`,
            payloadChanges: { amount, source, reason: reason ?? null, receivedAt: receivedAt.toISOString() },
            request: req,
        });

        return NextResponse.json({ success: true, credit });
    } catch (err: any) {
        logError('corporate.billing.credits.post', err);
        return NextResponse.json({ success: false, error: err.message || 'Error registrando saldo a favor' }, { status: 500 });
    }
}
