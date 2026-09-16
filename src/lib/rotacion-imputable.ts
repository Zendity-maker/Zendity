/**
 * ¿ESTE HUECO SIN GIRAR ES DE QUIEN LO ESTÁ CERRANDO?
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EL FALLO QUE ESTO CORRIGE
 *
 * La penalidad por rotación tardía se mide contra la ÚLTIMA rotación del
 * residente, sin mirar quién la hizo. Así que la cobra quien CIERRA el hueco,
 * no quien lo abrió — justo a la persona que llegó y lo resolvió.
 *
 * Medido el 16-sep-2026 sobre las 26 penalidades de 30 días: **18 son huecos
 * heredados**. Los dueños reales eran Zuleyka Valcárcel (10), Carlos Negrón (5),
 * Brendali Collazo (2) y Yedaira González (1); se le cobraron a Neylianne
 * Torres (17) y a Caridad Veras (1).
 *
 * Una de ellas arrastraba **quince horas**: la rotación anterior era de las 5:42
 * de la mañana, de otra persona, y Neylianne entró a las 20:44.
 *
 * Y seis de sus penalidades eran UNA sola ráfaga del 21-ago a las 15:43 — el
 * mismo hueco de 2,6 h cobrado seis veces, una por cada residente que tocó.
 * Treinta puntos por una sesión de tecleo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA REGLA, EN UNA FRASE
 *
 * Se te cobra el hueco que abriste tú —la rotación anterior de ese residente es
 * tuya— y una sola vez por hueco, aunque en ese mismo rato registres a seis
 * residentes que venían del mismo descuido.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOS CAMPOS, NO UNO
 *
 * `isComplianceAlert` es el HECHO CLÍNICO y no se apaga nunca: un residente que
 * pasó quince horas sin girarse es un problema aunque a nadie se le cobre. Lo
 * leen el supervisor en la línea del turno, el reporte de supervisión y el cron
 * de úlceras.
 *
 * `esImputable` es la FACTURA, y es lo único que mira el desempeño. Separarlos
 * es lo que permite dejar de cobrar sin borrarle al supervisor un hueco real.
 */
import { prisma } from '@/lib/prisma';

export interface RotacionAnterior {
    nurseId: string;
    performedAt: Date;
}

export interface Veredicto {
    /** El hecho clínico: se pasó de la tolerancia. */
    tarde: boolean;
    /** La factura: además, el hueco es suyo y no se ha cobrado ya. */
    imputable: boolean;
    /** Por qué no se cobra, cuando no se cobra. Para el log, no para la fila. */
    porque: string;
}

/** Objetivo 120 min; tolerancia legal 15 más. */
export const TOLERANCIA_MIN = 135;

/**
 * Decide si una rotación llega tarde y si ese retraso se le puede cobrar a
 * quien la registra.
 *
 * `exento` lo pone quien llama con las razones que ya existían y que hasta hoy
 * solo apagaban un contador muerto: el residente no requiere rotación, no estaba
 * en el edificio, o el hueco atraviesa una caída del sistema.
 */
export async function evaluarRotacion(params: {
    caregiverId: string;
    anterior: RotacionAnterior | null;
    momento: Date;
    exento: boolean;
}): Promise<Veredicto> {
    const { caregiverId, anterior, momento, exento } = params;

    // Primera rotación registrada de este residente: no hay hueco que medir.
    if (!anterior) return { tarde: false, imputable: false, porque: 'primera rotación' };

    const minutos = (momento.getTime() - anterior.performedAt.getTime()) / 60000;
    const tarde = minutos > TOLERANCIA_MIN;
    if (!tarde) return { tarde: false, imputable: false, porque: 'a tiempo' };

    if (exento) return { tarde: true, imputable: false, porque: 'exento' };

    // AUTORÍA. El hueco solo es suyo si la rotación anterior la hizo ella.
    if (anterior.nurseId !== caregiverId) {
        return { tarde: true, imputable: false, porque: 'hueco heredado de otra persona' };
    }

    /**
     * UN COBRO POR HUECO.
     *
     * Si ya tiene una bandera imputable DENTRO de este mismo tramo —es decir,
     * posterior a la rotación que abrió el hueco— entonces ya pagó por él y lo
     * que viene detrás son los otros residentes de la misma ronda.
     *
     * Es la misma idea que la guarda de doble envío que ya existe en
     * /api/care/postural, pero por PERSONA y no por residente: aquella compara
     * `patientId`, y por eso seis residentes del mismo descuido pasaban los seis.
     */
    const yaCobrado = await prisma.posturalChangeLog.findFirst({
        where: {
            nurseId: caregiverId,
            esImputable: true,
            performedAt: { gt: anterior.performedAt, lte: momento },
        },
        select: { id: true },
    });
    if (yaCobrado) {
        return { tarde: true, imputable: false, porque: 'el mismo hueco ya se cobró una vez' };
    }

    return { tarde: true, imputable: true, porque: 'hueco propio' };
}
