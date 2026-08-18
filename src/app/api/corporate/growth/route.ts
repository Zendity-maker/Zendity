import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { logAudit } from '@/lib/audit';
import { GROWTH_FIELDS } from '@/lib/growth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/growth?month=YYYY-MM[&hqId=]
 * PUT /api/corporate/growth
 *
 * Embudo comercial del mes — carga manual del Director.
 * Alimenta la sección de Crecimiento del dashboard de socios.
 *
 * Complementa a CRMLead sin reemplazarlo: el CRM es el ESTADO del pipeline
 * vivo (quién está en qué etapa hoy); esto es el FLUJO del mes (cuántos tours
 * se hicieron en julio). Ver comentario del modelo en schema.prisma.
 *
 * Acceso: DIRECTOR/ADMIN — NO INVESTOR (un socio lee la tendencia, no la
 * escribe). Multi-sede vía resolveEffectiveHqId.
 */

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

function parseMonth(raw: string | null): Date | null {
    if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return null;
    const [y, m] = raw.split('-').map(Number);
    if (m < 1 || m > 12) return null;
    return new Date(Date.UTC(y, m - 1, 1));
}

export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const session = await getServerSession(authOptions);
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session!, searchParams.get('hqId'));
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        const now = new Date();
        const periodMonth = parseMonth(searchParams.get('month'))
            ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        const row = await prisma.monthlyGrowthSnapshot.findUnique({
            where: { headquartersId_periodMonth: { headquartersId: hqId, periodMonth } },
            select: {
                prospects: true, tours: true, evaluations: true,
                contracts: true, admissions: true, notes: true, updatedAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            hqId,
            month: periodMonth.toISOString().slice(0, 7),
            snapshot: {
                prospects: row?.prospects ?? 0,
                tours: row?.tours ?? 0,
                evaluations: row?.evaluations ?? 0,
                contracts: row?.contracts ?? 0,
                admissions: row?.admissions ?? 0,
                notes: row?.notes ?? null,
                updatedAt: row?.updatedAt ?? null,
            },
            hasData: !!row,
        });
    } catch (err: any) {
        logError('corporate.growth.get', err);
        return NextResponse.json({ success: false, error: 'Error cargando embudo' }, { status: 500 });
    }
}

/**
 * PUT — Guarda (upsert) el embudo de un mes.
 * Body: { month, hqId?, prospects, tours, evaluations, contracts, admissions, notes? }
 *
 * Si todos los contadores llegan en 0, se BORRA la fila: así el mes no cuenta
 * como "con datos" y la conversión no se calcula sobre ceros.
 */
export async function PUT(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json().catch(() => ({}));
        const session = await getServerSession(authOptions);
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session!, body.hqId ?? null);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        const periodMonth = parseMonth(body.month);
        if (!periodMonth) {
            return NextResponse.json({ success: false, error: 'month inválido (formato YYYY-MM)' }, { status: 400 });
        }

        const counts: Record<string, number> = {};
        for (const field of GROWTH_FIELDS) {
            const raw = body[field.key];
            const n = raw === '' || raw === null || raw === undefined ? 0 : Math.trunc(Number(raw));
            if (!Number.isFinite(n) || n < 0) {
                return NextResponse.json({ success: false, error: `Valor inválido en ${field.label}` }, { status: 400 });
            }
            counts[field.key] = n;
        }
        const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null;

        const previous = await prisma.monthlyGrowthSnapshot.findUnique({
            where: { headquartersId_periodMonth: { headquartersId: hqId, periodMonth } },
            select: { prospects: true, tours: true, evaluations: true, contracts: true, admissions: true },
        });

        const allZero = GROWTH_FIELDS.every(f => counts[f.key] === 0);
        if (allZero) {
            await prisma.monthlyGrowthSnapshot.deleteMany({
                where: { headquartersId: hqId, periodMonth },
            });
        } else {
            await prisma.monthlyGrowthSnapshot.upsert({
                where: { headquartersId_periodMonth: { headquartersId: hqId, periodMonth } },
                create: {
                    headquartersId: hqId, periodMonth, notes, createdById: auth.id,
                    prospects: counts.prospects, tours: counts.tours,
                    evaluations: counts.evaluations, contracts: counts.contracts,
                    admissions: counts.admissions,
                },
                update: {
                    notes,
                    prospects: counts.prospects, tours: counts.tours,
                    evaluations: counts.evaluations, contracts: counts.contracts,
                    admissions: counts.admissions,
                },
            });
        }

        await logAudit({
            headquartersId: hqId,
            performedById: auth.id,
            action: 'STATE_CHANGED',
            entityName: 'MonthlyGrowthSnapshot',
            entityId: `${hqId}_${periodMonth.toISOString().slice(0, 7)}`,
            resourceName: `Embudo comercial ${periodMonth.toISOString().slice(0, 7)}`,
            payloadChanges: { before: previous ?? null, after: allZero ? null : counts },
            request: req,
        });

        return NextResponse.json({ success: true, month: periodMonth.toISOString().slice(0, 7), snapshot: counts });
    } catch (err: any) {
        logError('corporate.growth.put', err);
        return NextResponse.json({ success: false, error: err.message || 'Error guardando embudo' }, { status: 500 });
    }
}
