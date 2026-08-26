/**
 * Zendi recomienda un curso a partir de lo que la persona vivió en sus turnos.
 *
 * La diferencia con una lista de cursos pendientes es el porqué. "Tienes 25
 * cursos sin tomar" no mueve a nadie; "este mes atendiste dos caídas, este
 * curso dura 25 minutos" sí. El motivo es lo que convierte una obligación en
 * una respuesta a algo que le pasó.
 *
 * DETERMINISTA A PROPÓSITO, no generado por IA. Tres razones: el motivo tiene
 * que ser literalmente cierto y comprobable contra los registros; no cuesta una
 * llamada a un modelo cada vez que alguien abre Academy; y si mañana alguien
 * pregunta "¿por qué me recomendó esto?", la respuesta está en el código y no
 * en un prompt.
 *
 * Si no hay señal en sus turnos, cae al curso de su rol y luego a la categoría
 * que no ha tocado. Nunca devuelve un curso ya aprobado.
 */
import { prisma } from '@/lib/prisma';

interface Señal {
    /** Fragmentos que se buscan en las notas de sus registros. */
    patrones: RegExp;
    /** Fragmento del título del curso que enseña esto. */
    curso: RegExp;
    /** Cómo se le explica. {n} se sustituye por las veces que ocurrió. */
    motivo: (n: number) => string;
}

const SEÑALES: Señal[] = [
    {
        patrones: /\b(ca[ií]da|se cay[oó]|resbal|tropez)/i,
        curso: /Respuesta a Ca[ií]das/i,
        motivo: n => n === 1
            ? 'El mes pasado atendiste una caída.'
            : `El mes pasado atendiste ${n} caídas.`,
    },
    {
        patrones: /\b(medicament|rechazo a medic|no quiso tomar|se niega a tomar|eMAR)/i,
        curso: /eMAR/i,
        motivo: n => n === 1
            ? 'Reportaste un problema con la medicación de un residente.'
            : `Reportaste ${n} situaciones con la medicación de residentes.`,
    },
    {
        patrones: /\b([uú]lcera|escara|punto de presi[oó]n|[aá]rea roja|piel)/i,
        curso: /Piel: Prevenci[oó]n/i,
        motivo: n => n === 1
            ? 'Atendiste una situación de piel o úlcera.'
            : `Atendiste ${n} situaciones de piel o úlcera.`,
    },
    {
        patrones: /\b(atragant|no est[aá] tragando|dificultad.*trag|se ahog|poco apetito|no comi[oó])/i,
        curso: /Alimentaci[oó]n, Hidrataci[oó]n/i,
        motivo: n => n === 1
            ? 'Reportaste una dificultad al alimentar a un residente.'
            : `Reportaste ${n} dificultades al alimentar a residentes.`,
    },
    {
        patrones: /\b(agresiv|alucin|desorient|grit|se qued[oó] ido|confund)/i,
        curso: /Demencia y Alzheimer/i,
        motivo: n => n === 1
            ? 'Manejaste una situación de conducta o confusión.'
            : `Manejaste ${n} situaciones de conducta o confusión.`,
    },
    {
        patrones: /\b(traslado|emergencia|hospital|satura|SpO2|convuls)/i,
        curso: /Emergencias: Los Primeros Minutos/i,
        // "Registraste", no "estuviste en": cuenta registros, y en los datos
        // reales hay traslados anotados dos veces. El motivo tiene que ser
        // cierto aunque el expediente tenga duplicados.
        motivo: n => n === 1
            ? 'Registraste un traslado de emergencia este mes.'
            : `Registraste ${n} traslados de emergencia este mes.`,
    },
];

const CURSO_POR_ROL: Record<string, RegExp> = {
    CAREGIVER: /El Cuidador en Zendity/i,
    SUPERVISOR: /El Supervisor en Zendity/i,
    NURSE: /La Enfermera en Zendity/i,
    DIRECTOR: /El Director en Zendity/i,
    ADMIN: /El Administrador en Zendity/i,
    SOCIAL_WORKER: /Trabajo Social en Zendity/i,
    MAINTENANCE: /Planta Fisica y Mantenimiento/i,
};

export interface Recomendacion {
    courseId: string;
    titulo: string;
    minutos: number;
    motivo: string;
}

export async function recomendarCurso(userId: string): Promise<Recomendacion | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, headquartersId: true },
    });
    if (!user) return null;

    const [cursos, aprobados] = await Promise.all([
        prisma.course.findMany({
            where: { headquartersId: user.headquartersId, isActive: true },
            select: { id: true, title: true, durationMins: true, category: true, targetRole: true },
            orderBy: { order: 'asc' },
        }),
        prisma.userCourse.findMany({
            where: { employeeId: user.id, status: 'COMPLETED' },
            select: { courseId: true, course: { select: { category: true } } },
        }),
    ]);

    const yaHechos = new Set(aprobados.map(a => a.courseId));
    const pendientes = cursos.filter(c => !yaHechos.has(c.id));
    if (pendientes.length === 0) return null;

    // Un curso dirigido a OTRO rol no se recomienda. Los que no tienen
    // targetRole valen para cualquiera.
    const aplicables = pendientes.filter(c => !c.targetRole || c.targetRole === user.role);
    const universo = aplicables.length > 0 ? aplicables : pendientes;

    // ── 1. Lo que vivió en sus turnos (últimos 30 días) ──────────────────
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const suyos = await prisma.dailyLog.findMany({
        where: { authorId: user.id, createdAt: { gte: desde } },
        select: { notes: true },
    });
    const texto = suyos.map(x => x.notes || '');

    let mejor: { señal: Señal; n: number } | null = null;
    for (const señal of SEÑALES) {
        const n = texto.filter(t => señal.patrones.test(t)).length;
        if (n > 0 && (!mejor || n > mejor.n)) mejor = { señal, n };
    }

    if (mejor) {
        const c = universo.find(x => mejor!.señal.curso.test(x.title));
        if (c) {
            return {
                courseId: c.id,
                titulo: c.title,
                minutos: c.durationMins,
                motivo: mejor.señal.motivo(mejor.n),
            };
        }
    }

    // ── 2. El curso de su rol ────────────────────────────────────────────
    const porRol = CURSO_POR_ROL[user.role];
    if (porRol) {
        const c = universo.find(x => porRol.test(x.title));
        if (c) {
            return {
                courseId: c.id,
                titulo: c.title,
                minutos: c.durationMins,
                motivo: 'Es el curso base de tu puesto y todavía no lo has tomado.',
            };
        }
    }

    // ── 3. La categoría que no ha tocado ─────────────────────────────────
    const categoriasHechas = new Set(aprobados.map(a => a.course.category));
    const virgen = universo.find(c => !categoriasHechas.has(c.category));
    if (virgen) {
        return {
            courseId: virgen.id,
            titulo: virgen.title,
            minutos: virgen.durationMins,
            motivo: `Todavía no has tomado ningún curso de ${virgen.category}.`,
        };
    }

    // ── 4. El más corto de los que quedan ────────────────────────────────
    const corto = [...universo].sort((a, b) => a.durationMins - b.durationMins)[0];
    return {
        courseId: corto.id,
        titulo: corto.title,
        minutos: corto.durationMins,
        motivo: 'Es el más corto de los que te quedan.',
    };
}
