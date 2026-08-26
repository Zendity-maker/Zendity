/**
 * Formación continua — el KPI de "un curso al mes".
 *
 * Pedido por Andrés el 26-ago-2026: que tomar cursos cuente en la evaluación,
 * porque "un empleado educándose continuamente es un empleado en crecimiento".
 *
 * POR QUÉ NO VA DENTRO DE complianceScore
 *
 * Ese score está capado en 100 y lo dominan otras cosas. Medido ese día:
 * Zuleyka y Mileska tenían 100 con CERO cursos, mientras que las dos con más
 * cursos (4 cada una) estaban en 86 y 80. Un curso más a quien está en el tope
 * le da +0 — el propio código tiene un comentario para "no mentir cuando el
 * score ya está en el cap". Motivar hacia un número que no responde es
 * construir a propósito el patrón de prometer sin entregar.
 *
 * Por eso la formación es su propia medida, y entra en la evaluación como una
 * categoría más.
 *
 * VENTANA RODANTE, NO AÑO NATURAL
 *
 * Con año calendario, en enero todos vuelven a cero y hay once meses sin
 * presión; en diciembre, quien va corto ya no puede recuperar. Rodante evita
 * las dos cosas.
 *
 * META PRORRATEADA
 *
 * Uno al mes, pero contando desde que la persona PUDO tomar cursos — no desde
 * que la contrataron. Se toma el momento más tardío entre su alta en Zendity y
 * la aparición de Academy en su sede. Academy nació el 21-may-2026: exigirle
 * 12 cursos a alguien que lleva tres meses con acceso sería reprobarlo por algo
 * que no pudo hacer.
 */
import { prisma } from '@/lib/prisma';

export const META_MENSUAL = 1;
export const VENTANA_MESES = 12;
const MS_MES = 30.44 * 24 * 60 * 60 * 1000;

export interface Formacion {
    aprobados: number;
    meta: number;
    porcentaje: number;
    mesesConAcceso: number;
    /** Cursos que aún puede tomar. Si es 0, la meta es inalcanzable y no debe puntuar en contra. */
    disponibles: number;
}

/**
 * Cursos aprobados en los últimos 12 meses frente a la meta que le toca.
 *
 * Devuelve null si el usuario no existe. `porcentaje` va de 0 a 100 y es lo
 * que entra en la evaluación.
 */
export async function formacionDe(userId: string): Promise<Formacion | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, createdAt: true, hiredAt: true, headquartersId: true },
    });
    if (!user) return null;

    const desdeVentana = new Date(Date.now() - VENTANA_MESES * MS_MES);

    // Cuándo apareció Academy en su sede.
    const primerCurso = await prisma.course.findFirst({
        where: { headquartersId: user.headquartersId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
    });

    // El más tardío de los tres: no se cuenta tiempo en el que no había nada
    // que tomar, ni tiempo anterior a que la persona tuviera cuenta.
    const inicio = new Date(Math.max(
        user.createdAt.getTime(),
        primerCurso?.createdAt.getTime() ?? 0,
        desdeVentana.getTime(),
    ));

    const mesesConAcceso = Math.max(0, (Date.now() - inicio.getTime()) / MS_MES);

    const aprobados = await prisma.userCourse.count({
        where: {
            employeeId: user.id,
            status: 'COMPLETED',
            completedAt: { gte: inicio },
        },
    });

    // Cuántos cursos existen que aún no ha aprobado. Si no quedan, la meta no
    // se puede cumplir y no debe contar en su contra.
    const [totalCursos, yaAprobados] = await Promise.all([
        prisma.course.count({ where: { headquartersId: user.headquartersId, isActive: true } }),
        prisma.userCourse.count({ where: { employeeId: user.id, status: 'COMPLETED' } }),
    ]);
    const disponibles = Math.max(0, totalCursos - yaAprobados);

    // Meta: un curso por mes completo con acceso, mínimo 1 en cuanto lleve un
    // mes, y nunca más de los que quedan por tomar.
    const metaBruta = Math.floor(mesesConAcceso) * META_MENSUAL;
    const meta = Math.min(Math.max(metaBruta, mesesConAcceso >= 1 ? 1 : 0), aprobados + disponibles);

    const porcentaje = meta === 0
        // Menos de un mes con acceso: no hay nada que exigir todavía. 100 y no
        // 0 — un empleado nuevo no empieza reprobado.
        ? 100
        : Math.min(100, Math.round((aprobados / meta) * 100));

    return {
        aprobados,
        meta,
        porcentaje,
        mesesConAcceso: Math.round(mesesConAcceso * 10) / 10,
        disponibles,
    };
}

/** La formación de todo un equipo, para la vista de la supervisora. */
export async function formacionDeEquipo(hqId: string) {
    const staff = await prisma.user.findMany({
        where: { headquartersId: hqId, isActive: true, isDeleted: false },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
    });
    const filas = [];
    for (const s of staff) {
        const f = await formacionDe(s.id);
        if (f) filas.push({ ...s, ...f });
    }
    return filas.sort((a, b) => a.porcentaje - b.porcentaje);
}
