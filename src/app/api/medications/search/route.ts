/**
 * GET /api/medications/search?q=<texto>
 *
 * Endpoint para autocompletado del catálogo global de Medication.
 * Devuelve resultados agrupados por categoría, orden alfabético dentro
 * de cada grupo.
 *
 * Query params:
 *   - q (opcional): texto a buscar en name. Si vacío → devuelve todo el catálogo.
 *   - limit (opcional, default 50): máximo de resultados.
 *
 * Auth: NURSE, CAREGIVER, DIRECTOR, ADMIN, SUPERVISOR.
 *
 * Response:
 *   {
 *     success: true,
 *     count: number,
 *     groups: [
 *       { category: 'Antihipertensivo', items: [...] },
 *       { category: 'Antidiabético', items: [...] },
 *       ...
 *     ]
 *   }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

const READ_ROLES = ['NURSE', 'CAREGIVER', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const auth = await requireRole(READ_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get('q') || '').trim();
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

        const where = q.length > 0
            ? {
                  OR: [
                      { name: { contains: q, mode: 'insensitive' as const } },
                      { category: { contains: q, mode: 'insensitive' as const } },
                  ],
              }
            : {};

        const items = await prisma.medication.findMany({
            where,
            select: {
                id: true,
                name: true,
                dosage: true,
                route: true,
                category: true,
                isControlled: true,
                requiresFridge: true,
                withFood: true,
            },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
            take: limit,
        });

        // Agrupar por categoría preservando orden alfabético
        const groupsMap = new Map<string, typeof items>();
        for (const item of items) {
            const cat = item.category || 'Sin clasificar';
            if (!groupsMap.has(cat)) groupsMap.set(cat, []);
            groupsMap.get(cat)!.push(item);
        }

        // Convertir a array de groups con categorías clínicas primero,
        // "Sin clasificar" e "Intake Draft" al final
        const groups = Array.from(groupsMap.entries())
            .map(([category, items]) => ({ category, items }))
            .sort((a, b) => {
                const lowPriority = ['Sin clasificar', 'Intake Draft', 'General'];
                const aLow = lowPriority.includes(a.category);
                const bLow = lowPriority.includes(b.category);
                if (aLow && !bLow) return 1;
                if (!aLow && bLow) return -1;
                return a.category.localeCompare(b.category);
            });

        return NextResponse.json({
            success: true,
            count: items.length,
            groups,
        });
    } catch (error: any) {
        console.error('[api/medications/search]', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error' },
            { status: 500 }
        );
    }
}
