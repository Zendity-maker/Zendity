/**
 * GET /api/cron/dispatch-frequent
 *
 * Cron consolidado cada 15 min que ejecuta SECUENCIALMENTE tres tareas que
 * antes corrían cada 5 min en endpoints separados:
 *   1. vitals-reminder           — recordatorios y penalty cap
 *   2. shift-redistribute        — round-robin de colores no cubiertos
 *   3. expire-cleaning-requests  — marca EXPIRED las cleaningRequest vencidas
 *
 * POR QUÉ:
 * En el modelo serverless anterior, los 3 crons se invocaban cada 5 min
 * separadamente — cada uno levantaba una function instance fresca con su
 * propio pool TCP de Prisma. Resultado: ~36 conexiones/hora solo de estos
 * 3 crons.
 *
 * Ahora UNA sola invocación cada 15 min comparte el mismo singleton de
 * Prisma y reusa la misma conexión TCP entre las 3 tareas. Reduce el
 * tráfico de conexiones ~3x.
 *
 * AISLAMIENTO DE FALLOS:
 * Si una tarea falla, las demás siguen ejecutándose. Cada error se loguea
 * pero no detiene el dispatch.
 *
 * AUTH: Bearer CRON_SECRET (igual que los crons originales).
 */

import { NextResponse } from 'next/server';
import { GET as vitalsReminderGET } from '@/app/api/cron/vitals-reminder/route';
import { GET as shiftRedistributeGET } from '@/app/api/cron/shift-redistribute/route';
import { GET as expireCleaningGET } from '@/app/api/cron/expire-cleaning-requests/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface TaskResult {
    name: string;
    ok: boolean;
    status: number;
    durationMs: number;
    error?: string;
}

async function runTask(
    name: string,
    handler: (req: Request) => Promise<Response>,
    req: Request,
): Promise<TaskResult> {
    const start = Date.now();
    try {
        const res = await handler(req);
        const durationMs = Date.now() - start;
        return {
            name,
            ok: res.ok,
            status: res.status,
            durationMs,
            ...(res.ok ? {} : { error: await res.clone().text().then(t => t.slice(0, 200)) }),
        };
    } catch (e: any) {
        return {
            name,
            ok: false,
            status: 500,
            durationMs: Date.now() - start,
            error: e?.message?.slice(0, 200) || 'Unknown error',
        };
    }
}

export async function GET(req: Request) {
    // Auth — mismo Bearer que los crons originales
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json(
            { error: 'CRON_SECRET no configurado en entorno' },
            { status: 500 },
        );
    }
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Firma CRON Inválida' },
            { status: 401 },
        );
    }

    const startedAt = new Date();
    const results: TaskResult[] = [];

    // Ejecución SECUENCIAL — reusa el mismo singleton de Prisma entre tareas.
    // Si una falla, las demás siguen (aislamiento por try/catch en runTask).
    results.push(await runTask('vitals-reminder', vitalsReminderGET, req));
    results.push(await runTask('shift-redistribute', shiftRedistributeGET, req));
    results.push(await runTask('expire-cleaning-requests', expireCleaningGET, req));

    const totalMs = results.reduce((s, r) => s + r.durationMs, 0);
    const allOk = results.every(r => r.ok);

    return NextResponse.json(
        {
            ok: allOk,
            startedAt: startedAt.toISOString(),
            totalMs,
            tasks: results,
        },
        { status: allOk ? 200 : 207 }, // 207 Multi-Status si alguna falló
    );
}
