import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCronSecret } from '@/lib/cron-auth';
import { sincronizarCalendario } from '@/lib/calendar-sync';

export const dynamic = 'force-dynamic';

/**
 * CRON — llena el calendario. Cada dos horas (ver vercel.json).
 *
 * EL CABLE QUE FALTABA. `/api/corporate/calendar/sync` existía desde que se
 * construyó el módulo y NO LO LLAMABA NADIE: ni un cron, ni un botón, ni la
 * propia pantalla del calendario. Resultado medido el 14-sep-2026: CERO
 * eventos en toda la historia de la base. Dos piezas correctas y ningún cable
 * entre ellas — el antipatrón "promete y no entrega" en su forma más cara,
 * porque todo el trabajo estaba hecho.
 *
 * Cada dos horas y no cada día: la fuente de dosis no administradas mira el día
 * en curso, así que un barrido diario las vería cuando ya no sirve para nada.
 */
export async function GET(req: Request) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

    try {
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });

        const resumen: { sede: string; creados: number; cerrados: number }[] = [];
        for (const sede of sedes) {
            try {
                const r = await sincronizarCalendario(sede.id);
                resumen.push({ sede: sede.name, creados: r.creados, cerrados: r.cerrados });
                if (r.creados > 0 || r.cerrados > 0) {
                    console.log(`[cron/calendar-sync] ${sede.name}: +${r.creados} / cerrados ${r.cerrados}`);
                }
            } catch (e) {
                // Una sede que falla no deja a las demás sin calendario.
                console.error(`[cron/calendar-sync] ${sede.name}:`, e);
                resumen.push({ sede: sede.name, creados: 0, cerrados: 0 });
            }
        }

        return NextResponse.json({ success: true, ranAt: new Date().toISOString(), resumen });
    } catch (error: any) {
        console.error('[cron/calendar-sync]', error);
        return NextResponse.json({ success: false, error: 'Error sincronizando el calendario' }, { status: 500 });
    }
}
