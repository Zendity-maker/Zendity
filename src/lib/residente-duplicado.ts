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
