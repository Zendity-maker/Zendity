/**
 * EL PLAN DE TRATAMIENTO DE UNA ÚLCERA
 * ────────────────────────────────────
 * Lo establece el HOME CARE, que no es personal del hogar: viene de fuera y el
 * hogar hace continuidad. Aquí solo se transcribe y se dice quién lo puso.
 *
 * POR QUÉ HACE FALTA. Hasta hoy el plan no tenía dónde vivir. Estaba en la
 * cabeza de alguien o en un papel, y la cuidadora que cambia un apósito a las
 * tres de la mañana no tenía forma de leer qué manda el tratamiento. Pedirle a
 * alguien que actúe y guardar la instrucción en otro sitio es pedirle que actúe
 * de memoria — y luego el expediente dice que siguió un plan que nunca vio.
 *
 * QUIÉN. Enfermería y dirección. Una cuidadora LEE el plan en el formulario del
 * cambio de apósito; no lo escribe, porque no es suyo.
 *
 * NO ES UN CAMPO LIBRE CUALQUIERA: se guarda quién lo estableció —en texto
 * libre, porque es una entidad de fuera como "Metro Pavia Home Care"— y cuándo
 * se actualizó. Un plan sin fecha no se sabe si sigue vigente.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const PUEDEN_ESCRIBIR_PLAN = ['NURSE', 'DIRECTOR', 'ADMIN'];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(PUEDEN_ESCRIBIR_PLAN);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await ctx.params;
        const body = await req.json().catch(() => ({}));
        const plan = String(body.planTratamiento ?? '').trim();
        const porQuien = String(body.planEstablecidoPor ?? '').trim();

        // Ownership por id: la úlcera tiene que ser de un residente de esta sede.
        const ulcera = await prisma.pressureUlcer.findFirst({
            where: { id, patient: { headquartersId: auth.headquartersId } },
            select: { id: true },
        });
        if (!ulcera) {
            return NextResponse.json({ success: false, error: 'Úlcera no encontrada' }, { status: 404 });
        }

        await prisma.pressureUlcer.update({
            where: { id },
            data: {
                // Vaciarlo es legítimo: un plan que ya no aplica es peor que
                // ninguno, porque alguien lo seguiría.
                planTratamiento: plan ? plan.slice(0, 4000) : null,
                planEstablecidoPor: porQuien ? porQuien.slice(0, 120) : null,
                planActualizadoAt: plan ? new Date() : null,
            },
        });

        return NextResponse.json({
            success: true,
            mensaje: plan ? 'Plan de tratamiento guardado.' : 'Plan de tratamiento borrado.',
        });
    } catch (error) {
        console.error('Plan UPP:', error);
        return NextResponse.json({ success: false, error: 'No se pudo guardar el plan' }, { status: 500 });
    }
}
