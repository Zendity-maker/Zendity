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
/* ─────────────── 7. RESIDENTE SIN PLAN DE CUIDO FIRMADO ─────────────────── */
/**
 * Un residente lleva meses en el hogar y su PAI sigue sin firmar, o no existe.
 *
 * Medido el 05-sep-2026: 16 de los 32 residentes activos de Cupey tenían el
 * plan COMPLETO —versión familiar, riesgos, objetivos, movilidad correcta,
 * editado a mano— y sin firmar. Doce llevaban 106 días así. No faltaba trabajo
 * clínico: faltaba una firma, y nada se lo decía a nadie.
 *
 * Los otros seis chequeos de este archivo vigilan planes EQUIVOCADOS —que
 * contradigan el expediente, que estén duplicados, que se aprueben sin
 * enviarse. Ninguno vigilaba la ausencia. Un plan que dice una mentira se ve;
 * un plan que no existe, no.
 *
 * El umbral son 30 días desde el ingreso. Antes de eso el plan se está
 * haciendo y señalarlo sería ruido; después, ya no es que esté en camino.
 */
const DIAS_SIN_PLAN = 30;

async function sinPlanDeCuidoFirmado(hqId: string): Promise<Hallazgo> {
    const limite = new Date(Date.now() - DIAS_SIN_PLAN * 86400000);
    const activos = await prisma.patient.findMany({
        where: { headquartersId: hqId, status: 'ACTIVE' },
        select: {
            name: true, admissionDate: true, createdAt: true,
            lifePlans: { select: { status: true }, where: { status: 'APPROVED' } },
        },
    });

    const casos = activos
        .filter(p => p.lifePlans.length === 0 && (p.admissionDate ?? p.createdAt) < limite)
        .map(p => {
            const desde = p.admissionDate ?? p.createdAt;
            const dias = Math.floor((Date.now() - desde.getTime()) / 86400000);
            return { nombre: p.name.trim(), dias };
        })
        .sort((a, b) => b.dias - a.dias);

    return {
        codigo: 'SIN_PLAN_DE_CUIDO',
        titulo: 'Residentes sin plan de cuido firmado',
        // ALTA y no CRITICA: en casi todos los casos el plan está escrito y
        // solo falta la firma, así que el cuido real no está a ciegas. Pero
        // ante el Departamento de la Familia, un residente sin PAI vigente es
        // un residente sin PAI.
        severidad: 'ALTA',
        total: casos.length,
        ejemplos: casos.slice(0, MAX_EJEMPLOS).map(c => `${c.nombre} — ${c.dias} días en el hogar`),
        accion: 'Life Plan (PAI) → filtro Borradores. Si el plan ya está completo, solo falta firmarlo.',
    };
}


/* ────────────── 8. LA DIETA NO REFLEJA EL DIAGNÓSTICO ──────────────────── */
/**
 * Un residente con diabetes documentada cuya prescripción de dieta no lleva el
 * modificador diabético. La cocina prepara desde ese campo: `/kitchen` cuenta
 * `dietDiabetic` para armar las bandejas del día. Si el campo está en false, la
 * bandeja sale regular por más que el diagnóstico esté escrito dos pantallas
 * más allá.
 *
 * MEDIDO EN CUPEY EL 05-sep-2026: 11 de 33 residentes activos tienen "Diabetes"
 * escrita en sus diagnósticos de intake. UNO tiene la dieta diabética marcada.
 * Seis de los diez restantes están además en tratamiento activo —Glimepiride,
 * Januvia, Metformin, y dos con insulina Lantus—. La cocina veía un diabético.
 *
 * No es un descuido de nadie en particular: el diagnóstico se escribe en el
 * intake, la dieta se prescribe en otra pantalla, y nada las compara. Esto las
 * compara.
 *
 * CRÍTICA porque el daño es diario y silencioso: se sirve tres veces al día,
 * nadie ve el error al servirlo, y el residente no está en condiciones de
 * notarlo.
 */

/** Antidiabéticos por nombre. Se compara en minúsculas contra Medication.name. */
const ANTIDIABETICOS = [
    'metformin', 'glipizide', 'glyburide', 'glimepiride', 'sitagliptin', 'januvia',
    'empagliflozin', 'jardiance', 'dapagliflozin', 'farxiga', 'pioglitazone', 'actos',
    'insulin', 'lantus', 'humulin', 'humalog', 'novolog', 'levemir', 'tresiba',
    'semaglutide', 'ozempic', 'dulaglutide', 'trulicity', 'liraglutide', 'victoza',
];

/** Diabetes en el texto del diagnóstico, sin contar "prediabetes" ni negaciones. */
const DIABETES_DX = /(?<!pre[\s-]?)(?<!no\s)(?<!sin\s)diabet/i;
/** Enfermedad renal que justifica el modificador renal. */
const RENAL_DX = /(fallo|insuficiencia|enfermedad)\s+renal|renal\s+cr[oó]nic|\bERC\b|nefropat|di[aá]lisis/i;

async function dietaNoReflejaDiagnostico(hqId: string): Promise<Hallazgo> {
    const activos = await prisma.patient.findMany({
        where: { headquartersId: hqId, status: 'ACTIVE' },
        select: {
            name: true, dietDiabetic: true, dietRenal: true, needsDialysis: true,
            intakeData: { select: { diagnoses: true, medicalHistory: true } },
            medications: {
                where: { isActive: true },
                select: { medication: { select: { name: true } } },
            },
        },
    });

    const casos: string[] = [];
    for (const p of activos) {
        const dx = `${p.intakeData?.diagnoses ?? ''} ${p.intakeData?.medicalHistory ?? ''}`;
        const meds = p.medications.map(m => m.medication.name.toLowerCase());

        // Diabetes: el diagnóstico escrito, o el tratamiento en curso.
        const tratamiento = meds.filter(n => ANTIDIABETICOS.some(a => n.includes(a)));
        if (!p.dietDiabetic && (DIABETES_DX.test(dx) || tratamiento.length > 0)) {
            const porque = tratamiento.length > 0
                ? `en tratamiento con ${tratamiento[0]}`
                : 'diagnóstico de diabetes en el expediente';
            casos.push(`${p.name.trim()} — ${porque}, y su dieta no está marcada como diabética`);
        }

        // Renal: la diálisis ya está marcada en el expediente, o el diagnóstico.
        if (!p.dietRenal && (p.needsDialysis || RENAL_DX.test(dx))) {
            const porque = p.needsDialysis ? 'recibe diálisis' : 'enfermedad renal en el expediente';
            casos.push(`${p.name.trim()} — ${porque}, y su dieta no está marcada como renal`);
        }
    }

    return {
        codigo: 'DIETA_NO_REFLEJA_DIAGNOSTICO',
        titulo: 'La dieta prescrita no refleja el diagnóstico',
        severidad: 'CRITICA',
        total: casos.length,
        ejemplos: casos.slice(0, MAX_EJEMPLOS),
        accion: 'Expediente del residente → Prescripción de dieta. Si el diagnóstico no aplica a la alimentación, corregir el diagnóstico; si aplica, marcar el modificador. La cocina lee ese campo.',
    };
}

/* ───────────── 9. CONTROLADO QUE EL SISTEMA NO SABE QUE LO ES ──────────── */
/**
 * `Medication.isControlled` pinta el rótulo "Controlado" en la tableta de la
 * cuidadora, junto al medicamento, en el momento de administrarlo.
 *
 * MEDIDO EL 05-sep-2026: 197 medicamentos en el catálogo, CERO marcados. Entre
 * ellos Clonazepam 0.5 mg, Clonazepam 1 mg y Lorazepam 0.5 mg — benzodiacepinas
 * de Lista IV. El rótulo existe desde que se escribió la pantalla y no se ha
 * mostrado nunca, porque no hay ninguna fila que lo encienda.
 *
 * Se limita a las sustancias federalmente reguladas y sin ambigüedad. Los
 * antipsicóticos —Quetiapine, Risperidone— NO entran: se vigilan de cerca en un
 * hogar, pero no son sustancias controladas, y meterlos aquí haría sonar el
 * chequeo por algo que no está mal. Gabapentin tampoco: su regulación varía por
 * jurisdicción.
 *
 * Solo se miran los que esta sede tiene prescritos hoy — un catálogo maestro
 * enorme convertiría esto en una lista que nadie termina.
 */
const CONTROLADOS_FEDERALES = [
    'clonazep', 'lorazep', 'alprazol', 'diazep', 'temazep', 'midazol', 'chlordiazep',
    'zolpidem', 'ambien', 'eszopiclone', 'lunesta', 'phenobarbital',
    'oxycod', 'hydrocod', 'morphin', 'morfin', 'fentanyl', 'hydromorph', 'codeine', 'codeina',
    'tramadol', 'methadon', 'buprenorph',
    'methylphen', 'amphetamin', 'dextroamphetamin', 'lisdexamfetamin',
    'pregabal', 'lyrica', 'testosteron', 'diazepam',
];

async function controladoSinMarcar(hqId: string): Promise<Hallazgo> {
    const recetados = await prisma.patientMedication.findMany({
        where: { patient: { headquartersId: hqId, status: 'ACTIVE' }, isActive: true },
        select: { medication: { select: { name: true, isControlled: true } } },
    });

    const nombres = new Map<string, number>();
    for (const r of recetados) {
        const m = r.medication;
        if (m.isControlled) continue;
        if (!CONTROLADOS_FEDERALES.some(c => m.name.toLowerCase().includes(c))) continue;
        nombres.set(m.name, (nombres.get(m.name) ?? 0) + 1);
    }

    const casos = [...nombres.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, n]) => `${nombre} — recetado a ${n} residente${n === 1 ? '' : 's'}`);

    return {
        codigo: 'CONTROLADO_SIN_MARCAR',
        titulo: 'Sustancias controladas sin marcar en el catálogo',
        severidad: 'ALTA',
        total: casos.length,
        ejemplos: casos.slice(0, MAX_EJEMPLOS),
        accion: 'Medicamentos → Catálogo → editar y marcar "Controlado". Mientras esté en false, la tableta de la cuidadora no muestra el rótulo al administrarlo.',
    };
}

/* ─────────────── 10. ÚLCERA ABIERTA QUE NADIE ESTÁ CERRANDO ─────────────── */
/**
 * Una úlcera por presión activa sin curación registrada, o abierta a nombre de
 * alguien que ya no está en el hogar.
 *
 * MEDIDO EL 05-sep-2026. Cuatro úlceras registradas en Cupey, las cuatro en
 * estado ACTIVE, cada una con EXACTAMENTE UNA curación: la del día en que se
 * declaró. Luz M. Ríos, sacra estadio 4, 77 días. Y dos de Wilfredo Matos, que
 * falleció hace 84.
 *
 * La causa no era descuido clínico: `/api/care/upp` solo tenía GET y un POST que
 * CREA una úlcera. No existía endpoint para añadir una segunda curación ni para
 * cerrarla. La pantalla enseñaba un historial al que era imposible añadir nada.
 * Ahora existe —/api/care/upp/[id]/curacion— y esto vigila que se use.
 *
 * SIETE DÍAS. Una úlcera de estadio 3 o 4 se cura mucho más seguido que eso;
 * el umbral no dice cada cuánto hay que curar, dice a partir de cuándo el
 * silencio deja de poder explicarse.
 *
 * CRÍTICA. Una úlcera por presión es la lesión que un hogar tiene que poder
 * demostrar que atendió. Sin registro, la respuesta a "¿qué se le hizo?" es
 * ninguna, se haya hecho o no.
 */
const DIAS_SIN_CURACION = 7;

async function ulceraSinSeguimiento(hqId: string): Promise<Hallazgo> {
    const ulceras = await prisma.pressureUlcer.findMany({
        where: { patient: { headquartersId: hqId }, resolvedAt: null, status: { not: 'RESOLVED' } },
        select: {
            bodyLocation: true, stage: true, identifiedAt: true,
            patient: { select: { name: true, status: true } },
            logs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
    });

    const limite = Date.now() - DIAS_SIN_CURACION * 86400000;
    const casos: { texto: string; orden: number }[] = [];

    for (const u of ulceras) {
        const ultima = u.logs[0]?.createdAt ?? u.identifiedAt;
        const dias = Math.floor((Date.now() - ultima.getTime()) / 86400000);
        const nombre = u.patient.name.trim();
        const lesion = `${u.bodyLocation} estadio ${u.stage}`;

        // El residente ya no está: la úlcera no se cura, se cierra el registro.
        if (u.patient.status !== 'ACTIVE' && u.patient.status !== 'TEMPORARY_LEAVE') {
            casos.push({
                texto: `${nombre} — ${lesion}, sigue abierta y el residente ya no está en el hogar`,
                orden: 100000,
            });
            continue;
        }
        if (ultima.getTime() < limite) {
            casos.push({
                texto: `${nombre} — ${lesion}, ${dias} días sin curación registrada`,
                // Estadio primero, después antigüedad: una estadio 4 de 10 días
                // pesa más que una estadio 1 de 40.
                orden: u.stage * 1000 + dias,
            });
        }
    }

    casos.sort((a, b) => b.orden - a.orden);

    return {
        codigo: 'ULCERA_SIN_SEGUIMIENTO',
        titulo: 'Úlceras por presión sin curación registrada',
        severidad: 'CRITICA',
        total: casos.length,
        ejemplos: casos.slice(0, MAX_EJEMPLOS).map(c => c.texto),
        accion: `Rotación / UPP → tocar la etiqueta de la úlcera y registrar la curación. Si el residente ya no está o la lesión cerró, marcarla como resuelta en esa misma pantalla.`,
    };
}

export async function verificarSede(hqId: string): Promise<Hallazgo[]> {
    const todas = await Promise.all([
        alergiasSinDocumentar(hqId),
        paiContradiceExpediente(hqId),
        caidasFueraDelModulo(hqId),
        aprobadoSinEfecto(hqId),
        sinContactoFamiliar(hqId),
        variosPaiVigentes(hqId),
        sinPlanDeCuidoFirmado(hqId),
        dietaNoReflejaDiagnostico(hqId),
        controladoSinMarcar(hqId),
        ulceraSinSeguimiento(hqId),
    ]);
    const orden: Record<Severidad, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2 };
    return todas
        .filter(h => h.total > 0)
        .sort((a, b) => orden[a.severidad] - orden[b.severidad] || b.total - a.total);
}
