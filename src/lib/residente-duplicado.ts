/**
 * GUARDA CONTRA CREAR AL MISMO RESIDENTE DOS VECES.
 *
 * Pasó dos veces en cuatro meses, y las dos quedaron escritas por quien las
 * limpió:
 *
 *   28-ago-2026  Carlos Sergio Torres Matos
 *                "Creado por error — duplicado de doble envío del asistente
 *                 de admisión"
 *   21-may-2026  Maria T. Gonzalez Avila
 *                "Creado Por error"
 *
 * En los dos casos el gemelo nació vacío, alguien lo notó el mismo día y lo dio
 * de baja con el motivo escrito. Eso está bien hecho. Lo que no está bien es
 * que haya que hacerlo: un doble toque, o un reintento porque la pantalla se
 * vio lenta, y ya hay dos expedientes con el mismo nombre.
 *
 * Es el tercer sitio donde aparece el mismo patrón. Los otros dos ya tienen su
 * guarda y el razonamiento es idéntico:
 *
 *   /api/care/vitals      30 tomas duplicadas de 5,483
 *   /api/care/incidents   una caída de Pura contada dos veces
 *
 * POR QUÉ DEVUELVE ÉXITO Y NO ERROR
 *
 * Igual que las otras dos. Quien da de alta a un residente hizo lo correcto; un
 * error en rojo le hace intentarlo otra vez, que es justo lo que produce el
 * duplicado. Se devuelve el que ya existe y se sigue el flujo con ese — el
 * asistente continúa con el expediente bueno sin que nadie tenga que enterarse.
 *
 * LA VENTANA SON 10 MINUTOS, y es deliberadamente larga comparada con los 2 y 5
 * minutos de vitales y caídas: dar de alta a alguien no se hace dos veces en
 * una tarde por casualidad, y el asistente de admisión es un formulario largo
 * donde un reintento puede tardar. Dos residentes REALES con el mismo nombre
 * exacto en la misma sede y en diez minutos no es un caso que valga la pena
 * proteger frente a este.
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const MINUTOS_VENTANA_DUPLICADO = 10;

/** Quita tildes, espacios de más y mayúsculas. "José  Pérez " === "jose perez". */
export function normalizarNombre(nombre: string): string {
    return nombre
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().replace(/\s+/g, ' ')
        .toLowerCase();
}

/**
 * ¿Ya se creó este residente hace un momento?
 *
 * Devuelve el id del que ya existe, o null si no hay tal cosa.
 */
export async function residenteRecienCreado(
    hqId: string,
    nombre: string,
): Promise<{ id: string; name: string } | null> {
    const limpio = normalizarNombre(nombre);
    if (!limpio) return null;

    const desde = new Date(Date.now() - MINUTOS_VENTANA_DUPLICADO * 60_000);

    // Se comparan normalizados en memoria: Postgres no tiene unaccent activado
    // en esta base, y son pocas filas — los creados en los últimos diez minutos.
    const recientes = await prisma.patient.findMany({
        where: { headquartersId: hqId, createdAt: { gte: desde } },
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    const igual = recientes.find(p => normalizarNombre(p.name) === limpio);
    return igual ? { id: igual.id, name: igual.name } : null;
}

/**
 * CREAR UN RESIDENTE SIN QUE DOS ENVÍOS A LA VEZ CREEN DOS.
 *
 * ═══ POR QUÉ NO BASTABA `residenteRecienCreado` ═══
 *
 * La guarda de arriba LEE y luego el llamador ESCRIBE, y entre las dos cosas no
 * hay nada. Dos peticiones simultáneas leen las dos «no hay duplicado» y las dos
 * insertan. No es teórico: medido el 03-oct-2026 en producción, de los cuatro
 * duplicados de catorce días, **dos nacieron en el mismo segundo**:
 *
 *     Jose R. Lozada Pagan   ×2 a las 17:41:59 — 0,0 min de diferencia
 *     Jose L. Tapia Rivera   ×2 a las 12:14:22 y 12:14:23
 *
 * Nombres idénticos, guarda puesta, y pasó igual. La guarda no estaba mal
 * escrita: la carrera le ganaba. Es lo que la hacía parecer que funcionaba —
 * atrapa el reintento lento, que es el caso visible, y pierde el doble toque,
 * que es el que de verdad ocurre.
 *
 * ═══ CÓMO SE CIERRA ═══
 *
 * Un cerrojo de aviso de PostgreSQL (`pg_advisory_xact_lock`) sobre la clave
 * «esta sede + este nombre», tomado DENTRO de la transacción que comprueba y
 * crea. El segundo envío espera a que el primero termine, y entonces ya ve el
 * residente que el primero creó.
 *
 * Se eligió esto y no un índice único porque dos residentes REALES pueden
 * llamarse igual con los años, y un índice lo impediría para siempre. El
 * cerrojo solo serializa los diez minutos de la ventana; pasados, dos personas
 * con el mismo nombre se admiten sin problema.
 *
 * El cerrojo se suelta solo al terminar la transacción, con éxito o con error:
 * `pg_advisory_xact_lock` es de transacción, no de sesión. Un fallo a mitad no
 * deja la puerta trancada.
 */
export async function crearResidenteSinDuplicar<T>(
    hqId: string,
    nombre: string,
    crear: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<{ yaExistia: { id: string; name: string } | null; creado: T | null }> {
    const limpio = normalizarNombre(nombre);

    return prisma.$transaction(async (tx) => {
        // La clave del cerrojo es la sede + el nombre normalizado. Dos altas de
        // personas distintas no se estorban; dos de la misma se ponen en fila.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${hqId}|${limpio}`}))`;

        const desde = new Date(Date.now() - MINUTOS_VENTANA_DUPLICADO * 60_000);
        const recientes = await tx.patient.findMany({
            where: { headquartersId: hqId, createdAt: { gte: desde } },
            select: { id: true, name: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        const igual = limpio ? recientes.find(p => normalizarNombre(p.name) === limpio) : null;
        if (igual) return { yaExistia: { id: igual.id, name: igual.name }, creado: null };

        return { yaExistia: null, creado: await crear(tx) };
    });
}
