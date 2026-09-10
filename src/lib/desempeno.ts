/**
 * MI DESEMPEÑO — la medida que ve el propio empleado.
 *
 * Nace el 09-sep-2026, de una frase de Andrés: "es importante para mí que el
 * empleado tenga una medida para su desempeño." Tiene razón: si le pides a
 * alguien que mejore, tiene que poder ver en qué.
 *
 * Lo que NO es: el complianceScore. Ese número está oculto (ver
 * z-score-visible.ts) porque estaba invertido —premiaba justo a quien menos
 * documenta— y porque lo escriben ocho sitios que no se hablan.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TRES REGLAS DE DISEÑO, cada una por un fallo que ya vimos
 *
 * 1. NO SE FUNDE EN UN NÚMERO. Yedaira reporta 3.5 veces más que la media de
 *    su turno Y tiene 8 observaciones de higiene y puntualidad. Las dos son
 *    verdad. Un entero que las promedia destruye las dos y no dice qué hacer.
 *
 * 2. SE COMPARA CONTRA EL MISMO TURNO, nunca contra el hogar entero. De 4,845
 *    vitales en 90 días, TRES se tomaron de noche. Una medida que no distinga
 *    el turno condena a la gente de noche a salir última para siempre, por
 *    hacer bien su trabajo. Yedaira con 0.14 reportes/turno es la mejor de la
 *    noche; en la tarde sería la penúltima.
 *
 * 3. LAS OBSERVACIONES DISCIPLINARIAS VAN APARTE, jamás sumadas. Eso es un
 *    proceso con firma y derecho a réplica, no un punto que se resta. Y solo
 *    las APLICADAS: una descartada significa que la persona quedó exonerada.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ CAMBIA SEGÚN EL ROL
 *
 * Medido el 09-sep-2026 sobre 90 días, lo que cada rol deja registrado:
 *
 *   CAREGIVER (10)    522 turnos, 11,541 eMAR, 3,369 comidas, 11,447 rotaciones
 *   SUPERVISOR (2)    igual que arriba —también trabajan piso— más 14 rondas
 *   DIRECTOR (2)      nada de piso; sí revisan cambios y levantan observaciones
 *   KITCHEN (1)       CERO
 *   MAINTENANCE (1)   CERO
 *   SOCIAL_WORKER (2) CERO
 *
 * Ese cero no es que no trabajen: es que Zendity no recoge lo que hacen. La
 * cocina aparece en MealLog, pero registrado por la CUIDADORA que sirvió, no
 * por quien cocinó. A esos roles la app solo les puede enseñar lo que otros
 * escribieron sobre ellos — observaciones y evaluaciones — y la pantalla lo
 * dice con esas palabras en vez de fingir una métrica que no existe.
 */
import { prisma } from '@/lib/prisma';
import { PUEDEN_REVISAR_CAMBIO, pasoElCompromiso, HORAS_PARA_REVISAR_CAMBIO } from '@/lib/cambios-de-condicion';

/** Solo cuenta lo que escribió una persona. El resto lo genera un endpoint. */
const ESCRITO_A_MANO = /^\[(NOTA DE TURNO|ALERTA CLÍNICA|ALERTA UPP\/PIEL|MEDICAMENTO SIN ADMINISTRAR)\]/;

const ROLES_DE_PISO = ['CAREGIVER', 'SUPERVISOR', 'NURSE'];

const hora = (d: Date) => ((d.getUTCHours() - 4) + 24) % 24;   // AST
const turnoDe = (h: number) => h >= 5 && h < 13 ? 'mañana' : h >= 13 && h < 21 ? 'tarde' : 'noche';

export interface Medida {
    etiqueta: string;
    valor: string;
    /** Contra qué se compara. Sin esto un número suelto no dice nada. */
    referencia?: string;
    detalle?: string;
}

export interface Desempeno {
    nombre: string;
    rol: string;
    dias: number;
    esPiso: boolean;
    /** Su turno predominante. Es la clave de toda comparación. */
    turno: string | null;
    medidas: Medida[];
    observaciones: { fecha: string; categoria: string; severidad: string }[];
    /** Lo que la app NO puede medir de este rol, dicho sin rodeos. */
    sinDatos: string | null;
}

export async function calcularDesempeno(userId: string, dias = 30): Promise<Desempeno | null> {
    const desde = new Date(Date.now() - dias * 86400000);

    const usuario = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true, secondaryRoles: true, headquartersId: true },
    });
    if (!usuario || !usuario.headquartersId) return null;

    const hqId = usuario.headquartersId;
    const roles = [usuario.role, ...(usuario.secondaryRoles ?? [])];
    const esPiso = roles.some(r => ROLES_DE_PISO.includes(r));

    // Las observaciones son de todos los roles. Solo APLICADAS: una descartada
    // significa que la persona quedó exonerada, y una en borrador no se le ha
    // entregado a nadie.
    const observaciones = await prisma.incidentReport.findMany({
        where: { employeeId: userId, status: 'APPLIED', createdAt: { gte: desde } },
        select: { createdAt: true, category: true, severity: true },
        orderBy: { createdAt: 'desc' },
    });

    const medidas: Medida[] = [];

    if (!esPiso) {
        return {
            nombre: usuario.name.trim(), rol: usuario.role, dias, esPiso: false, turno: null,
            medidas,
            observaciones: observaciones.map(o => ({
                fecha: o.createdAt.toISOString(), categoria: o.category, severidad: o.severity,
            })),
            sinDatos: 'Zéndity todavía no recoge el trabajo de este puesto. Lo que aparece aquí es lo que otros escribieron, no lo que hiciste.',
        };
    }

    // ── Turnos y cierres ────────────────────────────────────────────────
    const misTurnos = await prisma.shiftSession.findMany({
        where: { caregiverId: userId, startTime: { gte: desde } },
        select: { startTime: true, handoverCompleted: true },
    });

    const cuenta = new Map<string, number>();
    misTurnos.forEach(s => {
        const k = turnoDe(hora(s.startTime));
        cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    });
    const turno = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const cerrados = misTurnos.filter(s => s.handoverCompleted).length;
    medidas.push({
        etiqueta: 'Turnos cerrados con el relevo',
        valor: `${cerrados} de ${misTurnos.length}`,
        referencia: misTurnos.length > 0
            ? `${Math.round(100 * cerrados / misTurnos.length)}% de los turnos que trabajaste`
            : undefined,
        detalle: 'Un turno sin cerrar deja al que entra sin saber qué pasó.',
    });

    // ── Reportes escritos, contra la media de SU turno ──────────────────
    const [misLogs, misCambios] = await Promise.all([
        prisma.dailyLog.findMany({
            where: { authorId: userId, createdAt: { gte: desde }, notes: { not: null } },
            select: { notes: true },
        }),
        prisma.cambioDeCondicion.count({
            where: { reportadoPorId: userId, reportadoAt: { gte: desde } },
        }),
    ]);
    const mios = misLogs.filter(l => ESCRITO_A_MANO.test((l.notes ?? '').trim())).length + misCambios;

    /**
     * La media de su MISMO turno Y su MISMO puesto.
     *
     * El puesto importa tanto como el turno. Las dos supervisoras escriben la
     * mitad de todo lo que se reporta en el hogar —es parte de su trabajo— y
     * meterlas en la media de las cuidadoras sube el listón contra gente que
     * tiene otro puesto. Medido: la media de la tarde pasa de 0.36 con las
     * supervisoras dentro a lo que de verdad hacen las cuidadoras sin ellas.
     */
    const mismoPuesto = await prisma.user.findMany({
        where: { headquartersId: hqId, isActive: true, isDeleted: false, role: usuario.role },
        select: { id: true },
    });
    const idsPuesto = new Set(mismoPuesto.map(u => u.id));

    const todosTurnos = await prisma.shiftSession.findMany({
        where: { headquartersId: hqId, startTime: { gte: desde }, caregiverId: { in: [...idsPuesto] } },
        select: { caregiverId: true, startTime: true },
    });
    const delTurno = todosTurnos.filter(s => turnoDe(hora(s.startTime)) === turno);
    const idsDelTurno = [...new Set(delTurno.map(s => s.caregiverId))];

    // OJO: hay que filtrar por la HORA en que se escribió, no solo por quién.
    // Mucha gente trabaja varios turnos: contar todo lo que escribieron en el
    // periodo mete en la media de la noche lo que esa misma persona escribió
    // de mañana, y la media sale inflada (0.69 en vez de 0.04, medido).
    const [logsDelTurno, cambiosDelTurno] = idsDelTurno.length > 0
        ? await Promise.all([
            prisma.dailyLog.findMany({
                where: { authorId: { in: idsDelTurno }, createdAt: { gte: desde }, notes: { not: null } },
                select: { notes: true, createdAt: true },
            }),
            prisma.cambioDeCondicion.findMany({
                where: { reportadoPorId: { in: idsDelTurno }, reportadoAt: { gte: desde } },
                select: { reportadoAt: true },
            }),
        ])
        : [[], []];
    const totalDelTurno =
        logsDelTurno.filter(l => ESCRITO_A_MANO.test((l.notes ?? '').trim())
            && turnoDe(hora(l.createdAt)) === turno).length
        + cambiosDelTurno.filter(c => turnoDe(hora(c.reportadoAt)) === turno).length;
    const mediaTurno = delTurno.length > 0 ? totalDelTurno / delTurno.length : 0;
    const mio = misTurnos.length > 0 ? mios / misTurnos.length : 0;

    medidas.push({
        etiqueta: 'Lo que reportaste del residente',
        valor: `${mios} en ${misTurnos.length} turnos`,
        referencia: turno
            ? `${mio.toFixed(2)} por turno · la media de tu turno de ${turno} es ${mediaTurno.toFixed(2)}`
            : undefined,
        detalle: 'Se compara solo con quien tiene tu mismo puesto y trabaja tu mismo turno. De noche hay menos que reportar, y eso no cuenta en contra.',
    });

    /**
     * ── LO QUE REVISASTE, Y SI LLEGASTE A TIEMPO ────────────────────────
     *
     * Esta es la medida que Andrés y Celia decidieron premiar el 10-sep-2026,
     * y la razón está en los datos: de 22 cambios reportados en 30 días, ONCE
     * seguían sin mirar, con una mediana de 123 horas. De los once resueltos,
     * DIEZ fueron accionables.
     *
     * O sea: el piso reporta bien y la otra punta de la cadena es la que está
     * rota. Premiar al piso por reportar MÁS habría metido más volumen en una
     * cola que ya estaba a medio atender — y quien escribe y no recibe
     * respuesta deja de escribir.
     *
     * No se cuenta cuántos revisó (eso premia despachar rápido y mal): se
     * cuenta qué proporción de los que revisó llegó dentro de las 48 horas.
     */
    if (PUEDEN_REVISAR_CAMBIO.includes(usuario.role)) {
        const revisados = await prisma.cambioDeCondicion.findMany({
            where: { revisadoPorId: userId, revisadoAt: { gte: desde } },
            select: { reportadoAt: true, revisadoAt: true },
        });
        const aTiempo = revisados.filter(c =>
            c.revisadoAt !== null && !pasoElCompromiso(c.reportadoAt, c.revisadoAt)).length;

        medidas.push({
            etiqueta: 'Lo que revisaste del piso',
            valor: revisados.length === 0
                ? 'Nada en este periodo'
                : `${aTiempo} de ${revisados.length} dentro de plazo`,
            referencia: revisados.length > 0
                ? `${Math.round(100 * aTiempo / revisados.length)}% en menos de ${HORAS_PARA_REVISAR_CAMBIO} horas`
                : undefined,
            detalle: 'Lo que alguien vio y nadie decide no sirve de aviso. Cuenta llegar a tiempo, no despachar muchos.',
        });
    }

    // ── Academy ─────────────────────────────────────────────────────────
    const [hechos, asignados] = await Promise.all([
        prisma.userCourse.count({ where: { employeeId: userId, completedAt: { not: null } } }),
        prisma.userCourse.count({ where: { employeeId: userId } }),
    ]);
    if (asignados > 0) {
        medidas.push({
            etiqueta: 'Academy',
            valor: `${hechos} de ${asignados} cursos`,
            referencia: `${Math.round(100 * hechos / asignados)}% completado`,
        });
    }

    return {
        nombre: usuario.name.trim(), rol: usuario.role, dias, esPiso: true, turno,
        medidas,
        observaciones: observaciones.map(o => ({
            fecha: o.createdAt.toISOString(), categoria: o.category, severidad: o.severity,
        })),
        sinDatos: null,
    };
}
