import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateDynamicScore } from '@/app/api/care/compliance-score/route';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sync-compliance
 *
 * Cron diario que recalcula el complianceScore de todos los usuarios
 * CAREGIVER / NURSE / SUPERVISOR / DIRECTOR basado en eventos de los
 * ÚLTIMOS 7 DÍAS (ventana rodante). Elimina la naturaleza monotónica
 * del score histórico — ahora refleja el estado reciente.
 *
 * Protección: Bearer token via CRON_SECRET.
 * Schedule: diario (ver vercel.json).
 */
export async function GET(req: Request) {
    // Auth vía CRON_SECRET
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const targetRoles: any[] = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR'];
        const users = await prisma.user.findMany({
            where: {
                role: { in: targetRoles },
                isActive: true,
                isDeleted: false,
            },
            select: { id: true, name: true, complianceScore: true, headquartersId: true, role: true },
        });

        console.log(`[sync-compliance] Procesando ${users.length} usuarios...`);

        let updated = 0;
        let unchanged = 0;
        const diffs: Array<{ name: string; role: string; from: number; to: number; delta: number }> = [];

        for (const u of users) {
            try {
                const { score } = await calculateDynamicScore(u.id);
                if (score !== u.complianceScore) {
                    await prisma.user.update({
                        where: { id: u.id },
                        data: { complianceScore: score },
                    });
                    diffs.push({
                        name: u.name,
                        role: u.role,
                        from: u.complianceScore,
                        to: score,
                        delta: score - u.complianceScore,
                    });
                    updated++;
                } else {
                    unchanged++;
                }
            } catch (e) {
                console.error(`[sync-compliance] Error en ${u.name}:`, e);
            }
        }

        console.log(`[sync-compliance] ${updated} actualizados, ${unchanged} sin cambios`);
        if (diffs.length > 0) {
            console.log(`[sync-compliance] Cambios:`, JSON.stringify(diffs.slice(0, 10), null, 2));
        }

        return NextResponse.json({
            success: true,
            totalUsers: users.length,
            updated,
            unchanged,
            diffs: diffs.slice(0, 50),
        });
    } catch (err: any) {
        console.error('[sync-compliance] Fallo catastrófico:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
