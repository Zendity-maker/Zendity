/**
 * LA FIRMA DE LA CUIDADORA Y LA FILA QUE EL CRON YA CREÓ SON LA MISMA DOSIS.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO QUE PASÓ EL 15-SEP-2026, EL PRIMER DÍA QUE EL CRON ESCRIBIÓ DE VERDAD
 *
 * A las 6:01 AM `materializarDosisDelDia` creó 366 filas PENDING — su primera
 * ejecución útil en cinco meses (antes firmaba con un usuario inexistente y el
 * 100% de los `create` reventaba dentro de un `catch` mudo).
 *
 * Pero la tableta no sabía de esas filas. `/api/care/meds/bulk` hacía
 * `createMany` de filas NUEVAS, con `scheduledTime` nulo. Así que cuando la
 * cuidadora dio las tiroides de las 5:00 AM —a las 4:41, adelantada, como se
 * hace— quedaron DOS filas por dosis: la suya firmada, y la del cron sin
 * firmar. A las 7:00 el barrido de vencidas marcó la del cron MISSED.
 *
 * Resultado medido a las 8:41 AM: de 15 dosis marcadas como omitidas, **10 se
 * habían dado y estaban firmadas**. Entre ellas la Synthroid de Iris Delia
 * Colón, administrada a las 4:49 AM.
 *
 * Y a las 10:00 iban las 208 del pack de las 8:00 AM por el mismo camino.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ LA CONCILIACIÓN ES EXACTA Y NO UNA ADIVINANZA
 *
 * El pack YA SABE qué horario está firmando: manda `scheduleTime: pack.label`
 * ("8:00 AM"). Y el cron construyó su fila con `astDateTime(hoy, h, m)` sobre
 * ese mismo texto. Así que reconstruyendo el instante igual que él, la fila se
 * busca por la llave única `(patientMedicationId, scheduledTime)` — un
 * `findUnique`, no un emparejamiento por cercanía.
 *
 * Eso importa: una regla de "la más próxima en el tiempo" adjudicaría mal en
 * cuanto alguien firme un pack con retraso de varias horas, que es justo el
 * caso en que un error de adjudicación es más caro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Y DE PASO ARREGLA EL DOBLE TOQUE
 *
 * Firmar sobre una fila que ya existe es idempotente por construcción: dos
 * toques dejan el mismo expediente. Una fila ya resuelta por otra persona NO se
 * pisa — se devuelve como ya resuelta, que es lo que CLAUDE.md pide: éxito con
 * la que existe, nunca un error rojo que invite a pulsar otra vez.
 */
import { prisma } from '@/lib/prisma';
import { astDateTime, parseTimeOfDay, todayStartAST } from '@/lib/dates';
import { finDelTurnoDe } from '@/lib/emar-schedule';
import type { MedStatus } from '@prisma/client';

/** Estados que significan "esta dosis todavía espera a alguien". */
const ABIERTOS: MedStatus[] = ['PENDING', 'MISSED'];

export interface FilaProgramada {
    id: string;
    patientMedicationId: string;
    status: MedStatus;
    /**
     * La dosis existe y YA la resolvió alguien. Quien llama NO debe crear otra
     * fila: debe devolver éxito con ésta. Ver el comentario de `conciliarUna`.
     */
    yaResuelta?: boolean;
}

export interface Conciliacion {
    /** El instante exacto que el cron usó para esta franja, o null si no aplica. */
    scheduledTime: Date | null;
    /** Filas abiertas que hay que FIRMAR en vez de duplicar. */
    aFirmar: FilaProgramada[];
    /** Medicamentos cuya dosis de hoy ya resolvió otra persona. No se tocan. */
    yaResueltos: string[];
    /** Medicamentos sin fila programada: PRN, semanales, o recetados hoy. */
    sinFila: string[];
}

/**
 * Reconstruye el instante que `materializarDosisDelDia` usó para esta franja.
 *
 * Devuelve null cuando el texto no es una hora —PRN, "Semanal"— que es
 * exactamente el mismo criterio por el que el cron no materializó nada: si él
 * no creó fila, aquí no hay nada que conciliar.
 */
export function instanteDeLaFranja(franja: string | null | undefined, ahora: Date): Date | null {
    if (!franja || !franja.trim()) return null;
    try {
        const { hour, minute } = parseTimeOfDay(franja.trim());
        return astDateTime(ahora, hour, minute);
    } catch {
        return null;
    }
}

/**
 * Reparte los medicamentos de un pack en tres montones: los que hay que firmar
 * sobre su fila ya existente, los que ya resolvió otra persona, y los que no
 * tienen fila programada y por tanto se crean como siempre.
 */
export async function conciliarPack(
    patientMedicationIds: string[],
    franja: string | null | undefined,
    ahora: Date,
): Promise<Conciliacion> {
    const scheduledTime = instanteDeLaFranja(franja, ahora);
    if (!scheduledTime || patientMedicationIds.length === 0) {
        return { scheduledTime: null, aFirmar: [], yaResueltos: [], sinFila: [...patientMedicationIds] };
    }

    const filas = await prisma.medicationAdministration.findMany({
        where: { patientMedicationId: { in: patientMedicationIds }, scheduledTime },
        select: { id: true, patientMedicationId: true, status: true },
    });

    const porMed = new Map(filas.map(f => [f.patientMedicationId, f]));
    const aFirmar: FilaProgramada[] = [];
    const yaResueltos: string[] = [];
    const sinFila: string[] = [];

    for (const id of patientMedicationIds) {
        const fila = porMed.get(id);
        if (!fila) { sinFila.push(id); continue; }
        if (ABIERTOS.includes(fila.status)) aFirmar.push(fila);
        else yaResueltos.push(id);
    }

    return { scheduledTime, aFirmar, yaResueltos, sinFila };
}

/**
 * LA MISMA CONCILIACIÓN PARA UN REGISTRO SUELTO — Y SIN ADIVINAR NUNCA.
 *
 * El pack sabe qué franja firma. Las rutas de registro unitario no siempre:
 * `/api/care/meds` y `/api/med` reciben el medicamento y el estado, y nada más.
 * Con eso no se puede saber si quien escribe está firmando la dosis de las 8:00
 * o la de las 12:00.
 *
 * La regla, entonces, es no adivinar:
 *
 *   1. Si llega la franja y se entiende, se busca la fila exacta. Igual que el
 *      pack, por la llave única. Sin ambigüedad posible.
 *   2. Si no llega, solo se concilia cuando hay **exactamente una** dosis
 *      abierta del turno en curso para ese medicamento. Una es una: no hay nada
 *      que elegir.
 *   3. En cualquier otro caso —ninguna abierta, o dos y no se sabe cuál—
 *      devuelve null y quien llama crea su fila suelta, como siempre.
 *
 * El caso 3 no es una derrota: adjudicar mal una firma es peor que dejar una
 * fila de más. La fila de más se ve; la firma en la dosis equivocada, no.
 *
 * "Turno en curso" y no "el día entero" porque el turno es la frontera real del
 * hogar (ver `finDelTurnoDe` en emar-schedule.ts): si alguien registra a media
 * tarde, no puede estar firmando el pack de la mañana, que ya cerró.
 */
export async function conciliarUna(
    patientMedicationId: string,
    franja: string | null | undefined,
    ahora: Date,
): Promise<FilaProgramada | null> {
    // 1. Con franja: búsqueda exacta.
    const scheduledTime = instanteDeLaFranja(franja, ahora);
    if (scheduledTime) {
        /**
         * TRES RESULTADOS, NO DOS: abierta, YA RESUELTA, o no hay.
         *
         * Devolvía `null` tanto cuando la dosis no existía como cuando ya la
         * había resuelto alguien, y quien llama no puede distinguirlos: crea
         * una fila nueva en los dos casos. Eso es el mecanismo exacto de las 6
         * dosis contadas dos veces del 21-sep-2026, y seguía vivo después de
         * anularlas — arreglar el dato sin arreglar la causa.
         *
         * `conciliarPack` ya distinguía los tres casos (`aFirmar`,
         * `yaResueltos`, `sinFila`) desde el 15-sep. Esta era la divergencia.
         */
        const fila = await prisma.medicationAdministration.findFirst({
            where: { patientMedicationId, scheduledTime },
            select: { id: true, patientMedicationId: true, status: true },
        });
        if (!fila) return null;
        return ABIERTOS.includes(fila.status)
            ? fila
            : { ...fila, yaResuelta: true };
    }

    /**
     * DIJO ALGO, Y ESE ALGO NO ES UNA HORA. No se concilia.
     *
     * El caso que lo pide es "PRN": un medicamento puede tener pauta fija Y
     * recibir además una dosis por razón necesaria. Si "PRN" cayera al camino
     * de abajo, esa dosis extra se firmaría encima de la programada de las
     * 8:00 — el expediente perdería una de las dos y diría que la de las 8
     * se dio a una hora que no fue.
     *
     * El camino de abajo es solo para quien NO dice nada. Decir "PRN", o
     * "08:00 AM (Semanal)", o cualquier texto que no sea un reloj, es
     * información: dice que esta administración no pertenece a ninguna franja
     * programada. Se respeta.
     */
    if (franja && franja.trim()) return null;

    // 2. Sin franja: solo si no hay nada que elegir.
    const inicioDelDia = todayStartAST();
    const abiertasDeHoy = await prisma.medicationAdministration.findMany({
        where: {
            patientMedicationId,
            status: { in: ABIERTOS },
            scheduledTime: { gte: inicioDelDia },
        },
        select: { id: true, patientMedicationId: true, status: true, scheduledTime: true },
        take: 20,
    });

    const cierreActual = finDelTurnoDe(ahora).getTime();
    const delTurnoEnCurso = abiertasDeHoy.filter(
        d => d.scheduledTime && finDelTurnoDe(d.scheduledTime).getTime() === cierreActual,
    );

    if (delTurnoEnCurso.length !== 1) return null;
    const { id, patientMedicationId: pmId, status } = delTurnoEnCurso[0];
    return { id, patientMedicationId: pmId, status };
}
