import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import { inferShiftTypeFromAST, canonicalShiftStartUtc } from '@/lib/shift-coverage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON cada 5 min — dispara round-robin de redistribución cuando un turno
 * lleva 15-20 min iniciado y quedaron colores sin cubrir.
 *
 * Ventana de activación: el cron sólo actúa si el turno canónico inició
 * hace 15-20 min. Evita dispararse en un turno ya maduro (>20 min) o
 * antes de que todos los cuidadores hayan tenido tiempo de hacer clock-in
 * (<15 min).
 *
 * Idempotencia: si ya existe al menos un ShiftPatientOverride activo del
 * mismo shiftType+shiftDate en la sede, el cron no redistribuye otra vez.
 * La segunda llegada (sustituto/tardío) se maneja vía resolveOverride en
 * shift/start (Parte C) y modal manual en el tablet.
 */
export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no configurado en entorno' }, { status: 500 });
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Firma CRON inválida' }, { status: 401 });
    }

    try {
        const shiftType = inferShiftTypeFromAST();
        const shiftStart = canonicalShiftStartUtc(shiftType);
        const minutesSinceStart = Math.round((Date.now() - shiftStart.getTime()) / 60000);

        // Ventana de activación: [15, 20) min después del inicio canónico.
        // Fuera de esa ventana, el cron no actúa.
        if (minutesSinceStart < 15 || minutesSinceStart >= 20) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: `Fuera de ventana de activación (minutesSinceStart=${minutesSinceStart}, window=[15,20))`,
                shiftType,
            });
        }

        const shiftDate = todayStartAST();
        const nextDay = new Date(shiftDate.getTime() + 24 * 60 * 60 * 1000);

        // Sedes activas que tengan al menos una ShiftSession del turno vigente
        // (startTime entre shiftStart y ahora)
        const hqs = await prisma.headquarters.findMany({
            where: {
                isActive: true,
                shiftSessions: {
                    some: {
                        startTime: { gte: shiftStart, lte: new Date() },
                        actualEndTime: null,
                    },
                },
            },
            select: { id: true, name: true },
        });

        const results: Array<{ hqId: string; hqName: string; redistributed: number; skipped?: string }> = [];

        for (const hq of hqs) {
            // Idempotencia: ¿ya hay override activo de este turno+día?
            const already = await prisma.shiftPatientOverride.findFirst({
                where: {
                    headquartersId: hq.id,
                    shiftType,
                    shiftDate: { gte: shiftDate, lt: nextDay },
                    isActive: true,
                },
                select: { id: true },
            });
            if (already) {
                results.push({ hqId: hq.id, hqName: hq.name, redistributed: 0, skipped: 'Ya redistribuido en este turno' });
                continue;
            }

            // Invocar el endpoint de redistribución por HTTP interno con CRON_SECRET.
            // Usamos el mismo host (VERCEL_URL o localhost) vía fetch.
            const baseUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : process.env.NEXTAUTH_URL || 'http://localhost:3000';

            try {
                const res = await fetch(`${baseUrl}/api/care/shift/redistribute`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                    },
                    body: JSON.stringify({ hqId: hq.id, shiftType, trigger: 'AUTO' }),
                });
                const data = await res.json();
                results.push({
                    hqId: hq.id,
                    hqName: hq.name,
                    redistributed: data.redistributed || 0,
                    ...(data.error ? { skipped: data.error } : {}),
                });
            } catch (e: any) {
                results.push({ hqId: hq.id, hqName: hq.name, redistributed: 0, skipped: `Error: ${e.message}` });
            }
        }

        return NextResponse.json({
            success: true,
            shiftType,
            minutesSinceStart,
            hqsScanned: hqs.length,
            results,
        });
    } catch (error: any) {
        console.error('cron/shift-redistribute error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error en cron shift-redistribute',
        }, { status: 500 });
    }
}
