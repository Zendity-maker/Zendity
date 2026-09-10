import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// La formula vive en el lib desde el 10-sep-2026. Un cron importando un
// route handler era la senal de que estaba en el sitio equivocado.
import { calculateDynamicScore } from '@/lib/compliance-score';
import { requireCronSecret } from '@/lib/cron-auth';

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
    const denied = requireCronSecret(req);
    if (denied) return denied;

    try {
        // Clínicos: métricas completas (rotaciones, meds, vitales + ScoreEvents)
        // Apoyo:    solo ScoreEvents (ACADEMY, EVALUACIÓN, MISIÓN, OBSERVACIONES)
        //           Las queries de tablas brutas retornan 0 para estos roles — correcto.
        const targetRoles: any[] = [
            'CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN',
            'KITCHEN', 'MAINTENANCE', 'CLEANING',
            'SOCIAL_WORKER', 'THERAPIST', 'BEAUTY_SPECIALIST',
        ];
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
                const delta = score - u.complianceScore;
                if (delta !== 0) {
                    /**
                     * SET ABSOLUTO. Este cron es desde el 10-sep-2026 el ÚNICO
                     * escritor del campo.
                     *
                     * Antes calculaba el delta contra el valor que había leído
                     * al empezar el loop y luego hacía un increment sobre el
                     * valor VIVO (applyScoreEvent). Es un read-modify-write con
                     * base rancia: si algo escribía durante los minutos que dura
                     * el recorrido, el resultado quedaba en target ± otro_delta.
                     * No era idempotente y no convergía a la fórmula. Eso
                     * explica que la fórmula diera 46 y en la base hubiera 0.
                     *
                     * Y ya no crea un ScoreEvent SHIFT: ese evento no era un
                     * hecho del turno de nadie, era el rastro del propio
                     * recálculo disfrazado de evento de desempeño, y ensuciaba
                     * la gráfica que ve el empleado.
                     */
                    await prisma.user.update({
                        where: { id: u.id },
                        data: { complianceScore: score },
                    });
                    diffs.push({
                        name: u.name,
                        role: u.role,
                        from: u.complianceScore,
                        to: score,
                        delta,
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
