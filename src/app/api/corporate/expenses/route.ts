import { NextResponse } from 'next/server';
import { ExpenseCategory } from '@prisma/client';
import { requireRole } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { EXPENSE_LABELS, EXPENSE_ORDER } from '@/lib/profitability';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/corporate/expenses?month=YYYY-MM
 * PUT  /api/corporate/expenses
 *
 * Gastos operativos mensuales de la sede — carga manual del Director.
 * Base del margen que ven los socios (Fase 3 del dashboard de inversores).
 *
 * Acceso: DIRECTOR/ADMIN. Deliberadamente NO INVESTOR: un socio LEE la
 * rentabilidad en su dashboard, pero no carga los gastos del negocio.
 */

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

/** "2026-08" → Date UTC del día 1. null si el formato es inválido. */
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
        const hqId = auth.headquartersId;

        const { searchParams } = new URL(req.url);
        const now = new Date();
        const periodMonth = parseMonth(searchParams.get('month'))
            ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        const rows = await prisma.monthlyExpense.findMany({
            where: { headquartersId: hqId, periodMonth },
            select: { category: true, amount: true, notes: true, updatedAt: true },
        });
        const byCategory = new Map(rows.map(r => [r.category, r]));

        // Devolvemos SIEMPRE las 9 categorías (las vacías en 0) para que la UI
        // sea un formulario estable y el Director vea qué le falta cargar.
        const expenses = EXPENSE_ORDER.map(category => {
            const row = byCategory.get(category);
            return {
                category,
                label: EXPENSE_LABELS[category],
                amount: row?.amount ?? 0,
                notes: row?.notes ?? null,
                updatedAt: row?.updatedAt ?? null,
            };
        });

        return NextResponse.json({
            success: true,
            month: periodMonth.toISOString().slice(0, 7),
            expenses,
            total: expenses.reduce((s, e) => s + e.amount, 0),
            hasData: rows.length > 0,
        });
    } catch (err: any) {
        logError('corporate.expenses.get', err);
        return NextResponse.json({ success: false, error: 'Error cargando gastos' }, { status: 500 });
    }
}

/**
 * PUT — Guarda (upsert) los gastos de un mes.
 *
 * Body: { month: "YYYY-MM", expenses: [{ category, amount, notes? }] }
 *
 * Upsert por (sede, mes, categoría): recargar un mes ACTUALIZA en vez de
 * duplicar. Un monto en 0 borra la fila — así el mes no queda marcado como
 * "con datos" por categorías vacías, que inflaría el margen reportado.
 */
export async function PUT(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const periodMonth = parseMonth(body.month);
        if (!periodMonth) {
            return NextResponse.json({ success: false, error: 'month inválido (formato YYYY-MM)' }, { status: 400 });
        }
        if (!Array.isArray(body.expenses)) {
            return NextResponse.json({ success: false, error: 'expenses debe ser un arreglo' }, { status: 400 });
        }

        const validCategories = new Set(EXPENSE_ORDER as string[]);
        const entries: { category: ExpenseCategory; amount: number; notes: string | null }[] = [];
        for (const raw of body.expenses) {
            const category = String(raw?.category ?? '');
            if (!validCategories.has(category)) {
                return NextResponse.json({ success: false, error: `Categoría inválida: ${category}` }, { status: 400 });
            }
            const amount = Math.round(parseFloat(raw?.amount) * 100) / 100;
            if (!Number.isFinite(amount) || amount < 0) {
                return NextResponse.json({ success: false, error: `Monto inválido en ${category}` }, { status: 400 });
            }
            entries.push({
                category: category as ExpenseCategory,
                amount,
                notes: raw?.notes ? String(raw.notes).trim().slice(0, 500) : null,
            });
        }

        const previous = await prisma.monthlyExpense.findMany({
            where: { headquartersId: hqId, periodMonth },
            select: { category: true, amount: true },
        });
        const previousTotal = previous.reduce((s, r) => s + r.amount, 0);

        await prisma.$transaction(async (tx) => {
            for (const e of entries) {
                if (e.amount === 0) {
                    await tx.monthlyExpense.deleteMany({
                        where: { headquartersId: hqId, periodMonth, category: e.category },
                    });
                    continue;
                }
                await tx.monthlyExpense.upsert({
                    where: {
                        headquartersId_periodMonth_category: { headquartersId: hqId, periodMonth, category: e.category },
                    },
                    create: {
                        headquartersId: hqId, periodMonth, category: e.category,
                        amount: e.amount, notes: e.notes, createdById: auth.id,
                    },
                    update: { amount: e.amount, notes: e.notes },
                });
            }
        });

        const newTotal = entries.reduce((s, e) => s + e.amount, 0);

        // Auditoría: este número es el denominador del margen que ven los
        // socios. Un cambio sin rastro haría imposible explicar por qué la
        // rentabilidad de un mes cerrado cambió.
        await logAudit({
            headquartersId: hqId,
            performedById: auth.id,
            action: 'STATE_CHANGED',
            entityName: 'MonthlyExpense',
            entityId: `${hqId}_${periodMonth.toISOString().slice(0, 7)}`,
            resourceName: `Gastos ${periodMonth.toISOString().slice(0, 7)}`,
            payloadChanges: {
                total: { before: Math.round(previousTotal * 100) / 100, after: Math.round(newTotal * 100) / 100 },
                categorias: entries.filter(e => e.amount > 0).map(e => ({ c: e.category, a: e.amount })),
            },
            request: req,
        });

        return NextResponse.json({
            success: true,
            month: periodMonth.toISOString().slice(0, 7),
            total: Math.round(newTotal * 100) / 100,
        });
    } catch (err: any) {
        logError('corporate.expenses.put', err);
        return NextResponse.json({ success: false, error: err.message || 'Error guardando gastos' }, { status: 500 });
    }
}
