/**
 * VERIFICACIONES DE VERACIDAD
 * ───────────────────────────
 * Cada una nace de un fallo REAL que ocurrió y que nadie detectó hasta que un
 * humano se tropezó con él. La pregunta que responden no es "¿está viva la
 * app?" sino "¿lo que dice el expediente es cierto, y lo que se prometió pasó?".
 *
 * Historial de sep-2026 — así se encontró cada cosa, y por eso existe cada check:
 *
 *   El formulario de traslado de emergencia declaraba "NKA (No Known Allergies)"
 *   a 4 residentes con alergia documentada, 3 de ellas a penicilina. Lo encontré
 *   de casualidad revisando otra cosa. Ese papel va con el residente al hospital.
 *
 *   El PAI de una señora encamada con sonda PEG decía "movilidad independiente,
 *   sin restricciones aparentes". Lo encontró Andrés leyendo el plan.
 *
 *   8 de 10 caídas de 90 días nunca entraron al módulo de caídas: se reportaron
 *   como alerta en texto libre. El conteo estaba dividido por cinco, hacia abajo.
 *
 *   6 citas familiares aprobadas nunca generaron su evento en el calendario, y
 *   un PAI aprobado nunca envió su correo. Las dos cosas se "completaron" sin
 *   completarse.
 *
 * REGLA DE DISEÑO: todo hallazgo tiene que poder desaparecer. Una verificación
 * que grita cada día por algo que nadie va a arreglar entrena a la gente a
 * ignorarla, y entonces es peor que no tenerla — da sensación de vigilancia sin
 * vigilancia. Si un check empieza a sonar siempre, se arregla la causa o se
 * retira el check. No se deja sonando.
 */
import { prisma } from '@/lib/prisma';

export type Severidad = 'CRITICA' | 'ALTA' | 'MEDIA';

export interface Hallazgo {
    /** Identificador estable del check. */
    codigo: string;
    /** Qué se comprobó, en una línea que un director entienda. */
    titulo: string;
    severidad: Severidad;
    /** Cuántos casos. 0 = todo bien, no se reporta. */
    total: number;
    /** Nombres concretos — sin esto nadie sabe qué hacer. */
    ejemplos: string[];
    /** Qué hacer al respecto. */
    accion: string;
}

const MAX_EJEMPLOS = 8;

/* ───────────────────────── 1. ALERGIAS SIN DOCUMENTAR ───────────────────── */
/**
 * El formulario de traslado ya no miente —lee IntakeData.allergies— pero si ese
 * campo está vacío el papel dice "NO DOCUMENTADO". Eso es honesto y es mejor que
 * el "NKA" anterior, pero sigue siendo un residente que llega a emergencias sin
 * información de alergias. Es una pregunta a la familia, no un bug.
 */
async function alergiasSinDocumentar(hqId: string): Promise<Hallazgo> {
    const activos = await prisma.patient.findMany({
        where: { headquartersId: hqId, status: 'ACTIVE' },
        select: { name: true, intakeData: { select: { allergies: true } } },
    });
    const vacio = /^(n\s*\/?\s*a|nka|ninguna|nunguna|no|none|sin alergias|-|\.)?$/i;
    const sin = activos.filter(p => vacio.test((p.intakeData?.allergies ?? '').trim()));
    return {
        codigo: 'ALERGIAS_SIN_DOCUMENTAR',
        titulo: 'Residentes sin información de alergias en el expediente',
        severidad: 'ALTA',
        total: sin.length,
        ejemplos: sin.slice(0, MAX_EJEMPLOS).map(p => p.name.trim()),
        accion: 'Su formulario de traslado de emergencia dirá "NO DOCUMENTADO". Preguntar a la familia y registrarlo en el intake.',
    };
}

/* ──────────────────── 2. EL PAI CONTRADICE EL EXPEDIENTE ────────────────── */
/**
 * Un plan que afirma lo contrario del expediente es peor que uno vacío, porque
 * se firma, se archiva y se le envía a la familia como si fuera cierto.
 */
async function paiContradiceExpediente(hqId: string): Promise<Hallazgo> {
    const planes = await prisma.lifePlan.findMany({
        where: { patient: { headquartersId: hqId, status: 'ACTIVE' } },
        select: {
            mobility: true, dietDetails: true, status: true,
            patient: {
                select: {
                    name: true, diet: true,
                    intakeData: { select: { mobilityLevel: true } },
                },
            },
        },
    });

    const dice = (t: string | null, re: RegExp) => re.test(t || '');
    const MOVIL = /independiente|preservada|conservada|deambula|ambulator/i;
    const NEGADO = /no deambula|no camina|encamad|asistencia total/i;
    const SONDA = /peg|sonda|enteral/i;

    const malos: string[] = [];
    for (const pl of planes) {
        const inmovil = ['BEDRIDDEN', 'WHEELCHAIR'].includes(
            (pl.patient.intakeData?.mobilityLevel || '').toUpperCase(),
        );
        if (inmovil && dice(pl.mobility, MOVIL) && !dice(pl.mobility, NEGADO)) {
            malos.push(`${pl.patient.name.trim()} — el expediente dice ${pl.patient.intakeData?.mobilityLevel}, el plan dice "${(pl.mobility || '').slice(0, 40)}"`);
            continue;
        }
        // Sonda PEG que el plan no menciona en la dieta.
        if (SONDA.test(pl.patient.diet || '') && !dice(pl.dietDetails, SONDA)) {
            malos.push(`${pl.patient.name.trim()} — se alimenta por sonda y el plan no la menciona`);
        }
    }
    return {
        codigo: 'PAI_CONTRADICE_EXPEDIENTE',
        titulo: 'Planes de cuido que contradicen el expediente del residente',
        severidad: 'CRITICA',
        total: malos.length,
        ejemplos: malos.slice(0, MAX_EJEMPLOS),
        accion: 'Regenerar el PAI con Zendi y revisarlo antes de firmar. NO firmar mientras contradiga el expediente.',
    };
}

/* ─────────────────────── 3. CAÍDAS FUERA DEL MÓDULO ─────────────────────── */
/**
 * Las caídas se reportan como alerta en texto libre en vez de usarse el módulo.
 * El conteo del módulo subcuenta, y una caída que no entra ahí no dispara la
 * revisión de riesgo que le corresponde.
 */
async function caidasFueraDelModulo(hqId: string): Promise<Hallazgo> {
    const desde = new Date(Date.now() - 30 * 86400000);

    // Dos consultas agrupadas, no una por residente. La primera version hacia
    // dos queries POR PACIENTE: con 47 residentes eran ~94 viajes a la base y
    // el panel del super admin tardaba 7 segundos en dos sedes. Con mas
    // clientes habria sido inusable.
    const [menciones, registradas] = await Promise.all([
        prisma.dailyLog.findMany({
            where: {
                createdAt: { gte: desde },
                patient: { headquartersId: hqId },
                OR: [
                    { notes: { contains: 'caída', mode: 'insensitive' } },
                    { notes: { contains: 'caida', mode: 'insensitive' } },
                    { notes: { contains: 'se cayó', mode: 'insensitive' } },
                    { notes: { contains: 'se resbal', mode: 'insensitive' } },
                ],
            },
            select: { patientId: true, patient: { select: { name: true } } },
        }),
        prisma.fallIncident.groupBy({
            by: ['patientId'],
            where: { incidentDate: { gte: desde }, patient: { headquartersId: hqId } },
            _count: { _all: true },
        }),
    ]);

    const enModulo = new Map(registradas.map(r => [r.patientId, r._count._all]));
    const enNotas = new Map<string, { nombre: string; n: number }>();
    menciones.forEach(m => {
        const prev = enNotas.get(m.patientId);
        enNotas.set(m.patientId, { nombre: m.patient.name.trim(), n: (prev?.n ?? 0) + 1 });
    });

    const fuera: string[] = [];
    for (const [pid, { nombre, n }] of enNotas) {
        const reg = enModulo.get(pid) ?? 0;
        if (n > reg) fuera.push(`${nombre} — ${n} mención(es) en notas, ${reg} en el módulo`);
    }

    return {
        codigo: 'CAIDAS_FUERA_DEL_MODULO',
        titulo: 'Caídas mencionadas en notas que no están en el módulo de caídas',
        severidad: 'ALTA',
        total: fuera.length,
        ejemplos: fuera.slice(0, MAX_EJEMPLOS),
        accion: 'Registrar la caída en el módulo. Sin eso el conteo del hogar es falso y no se dispara la revisión de riesgo.',
    };
}

/* ───────────────────── 4. APROBADO SIN EFECTO ───────────────────────────── */
/**
 * Algo se marcó como hecho y su consecuencia no ocurrió. Es el patrón que mas
 * se repitio: la accion devuelve exito y nadie comprueba el efecto.
 */
async function aprobadoSinEfecto(hqId: string): Promise<Hallazgo> {
    const problemas: string[] = [];

    // Citas familiares aprobadas cuya fecha aun no paso y no tienen evento.
    const citas = await prisma.familyAppointment.findMany({
        where: { headquartersId: hqId, status: 'APPROVED', requestedDate: { gte: new Date() } },
        select: { patientId: true, requestedDate: true, patient: { select: { name: true } } },
    });
    for (const c of citas) {
        const d0 = new Date(c.requestedDate); d0.setUTCHours(0, 0, 0, 0);
        const d1 = new Date(d0.getTime() + 86400000);
        const ev = await prisma.headquartersEvent.count({
            where: { headquartersId: hqId, patientId: c.patientId, startTime: { gte: d0, lt: d1 } },
        });
        if (!ev) {
            problemas.push(`Cita de ${c.patient.name.trim()} el ${c.requestedDate.toISOString().slice(0, 10)} — aprobada, sin evento en el calendario`);
        }
    }

    // PAI aprobado que nunca envio su copia a la familia.
    const planes = await prisma.lifePlan.findMany({
        where: { patient: { headquartersId: hqId }, status: 'APPROVED', emailSentAt: null },
        select: { patient: { select: { name: true } } },
    });
    planes.forEach(p =>
        problemas.push(`PAI de ${p.patient.name.trim()} — aprobado, la familia nunca recibió su copia`),
    );

    return {
        codigo: 'APROBADO_SIN_EFECTO',
        titulo: 'Cosas marcadas como hechas cuya consecuencia no ocurrió',
        severidad: 'CRITICA',
        total: problemas.length,
        ejemplos: problemas.slice(0, MAX_EJEMPLOS),
        accion: 'Revisar cada caso: la cita no le llegará a la cuidadora, o la familia no sabe que su plan existe.',
    };
}

/* ─────────────────── 5. RESIDENTES SIN CONTACTO FAMILIAR ────────────────── */
async function sinContactoFamiliar(hqId: string): Promise<Hallazgo> {
    const sin = await prisma.patient.findMany({
        where: { headquartersId: hqId, status: 'ACTIVE', familyMembers: { none: {} } },
        select: { name: true },
        orderBy: { name: 'asc' },
    });
    return {
        codigo: 'SIN_CONTACTO_FAMILIAR',
        titulo: 'Residentes activos sin ningún familiar registrado',
        severidad: 'ALTA',
        total: sin.length,
        ejemplos: sin.slice(0, MAX_EJEMPLOS).map(p => p.name.trim()),
        accion: 'No hay a quién avisar en una emergencia, ni a quién enviarle el plan de cuido. Registrar el contacto en el expediente.',
    };
}

/* ────────────── 6. VARIOS PAI APROBADOS A LA VEZ ────────────────────────── */
/**
 * Nada impide que un residente tenga dos LifePlan en APPROVED al mismo tiempo, y
 * /api/family/pai devuelve TODOS los aprobados: la familia ve los dos.
 *
 * Lo encontró este mismo monitor en su primera corrida. Rosa M. Solis De Arce
 * tenía dos planes vigentes, uno diciendo "Encamado/a, requiere cambios
 * posturales" y otro "Movilidad funcional conservada". Su hija podía abrir
 * cualquiera de los dos. Un plan de cuido vigente tiene que ser uno solo.
 */
async function variosPaiVigentes(hqId: string): Promise<Hallazgo> {
    const aprobados = await prisma.lifePlan.findMany({
        where: { patient: { headquartersId: hqId, status: 'ACTIVE' }, status: 'APPROVED' },
        select: { patientId: true, type: true, approvedAt: true, patient: { select: { name: true } } },
        orderBy: { approvedAt: 'desc' },
    });
    const porPaciente = new Map<string, typeof aprobados>();
    aprobados.forEach(p => {
        const l = porPaciente.get(p.patientId) ?? [];
        l.push(p);
        porPaciente.set(p.patientId, l);
    });
    const duplicados = [...porPaciente.values()].filter(l => l.length > 1);
    return {
        codigo: 'VARIOS_PAI_VIGENTES',
        titulo: 'Residentes con más de un plan de cuido aprobado a la vez',
        severidad: 'CRITICA',
        total: duplicados.length,
        ejemplos: duplicados.slice(0, MAX_EJEMPLOS).map(
            l => `${l[0].patient.name.trim()} — ${l.length} planes vigentes (${l.map(x => x.type).join(', ')})`,
        ),
        accion: 'La familia ve todos los aprobados en su portal. Archivar los viejos y dejar uno solo vigente.',
    };
}

/** Corre todas las verificaciones de una sede y devuelve solo lo que falló. */
export async function verificarSede(hqId: string): Promise<Hallazgo[]> {
    const todas = await Promise.all([
        alergiasSinDocumentar(hqId),
        paiContradiceExpediente(hqId),
        caidasFueraDelModulo(hqId),
        aprobadoSinEfecto(hqId),
        sinContactoFamiliar(hqId),
        variosPaiVigentes(hqId),
    ]);
    const orden: Record<Severidad, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2 };
    return todas
        .filter(h => h.total > 0)
        .sort((a, b) => orden[a.severidad] - orden[b.severidad] || b.total - a.total);
}
