/**
 * Estado operativo de una sede — la MISMA vista a dos alturas.
 *
 * Decision de Andres el 26-ago-2026: el dashboard del director y el panel del
 * supervisor son la misma vista a distinta altura. El supervisor ve su piso y
 * su turno; el director ve la sede entera y el dia completo.
 *
 * Por eso las definiciones viven AQUI y no en cada pantalla. Si "cuidadores
 * activos" se calcula en dos sitios, en tres meses dicen numeros distintos y
 * nadie sabe cual creer — y eso ya nos paso el mismo dia con la rotacion UPP,
 * que tenia tres umbrales (120, 135 y 150) para una sola regla.
 *
 * QUE INCLUYE, y por que
 *
 * Andres describio lo que abre a mirar cada mañana: quien esta en turno, quien
 * se ausento, si hay una emergencia corriendo, y como va el turno. Nada de eso
 * estaba junto: las ausencias no aparecian en el dashboard, el progreso no
 * tenia denominador ("Baños hoy: 35" sin decir sobre cuantos), y lo que corre
 * ahora estaba partido entre dos pantallas.
 */
import { prisma } from '@/lib/prisma';
import { todayStartAST, clinicalDayCalendarUTCRange } from '@/lib/dates';

export interface EnTurno {
    caregiverId: string;
    nombre: string;
    /** Grupo(s) de color que cubre. Vacio = sin color asignado. */
    colores: string[];
    desde: Date;
}

export interface Ausencia {
    nombre: string;
    motivo: string | null;
    /** La distincion que importa: faltar avisando no es lo mismo que no aparecer. */
    aviso: boolean;
}

export interface Progreso {
    hecho: number;
    total: number;
}

export interface EstadoOperativo {
    enTurno: EnTurno[];
    ausencias: Ausencia[];
    /** Lo que esta ocurriendo ahora mismo y pide atencion. */
    corriendo: {
        enHospital: { nombre: string; desde: Date | null }[];
        alertasAbiertas: number;
        rotacionesVencidas: number;
    };
    /** Progreso del turno con su denominador. Un contador sin total no es progreso. */
    progreso: {
        banos: Progreso;
        comidas: Progreso;
        vitales: Progreso;
    };
    /** Residentes sin ningun registro hoy. Lo mas util que ya tenia el panel. */
    sinActividad: { id: string; nombre: string; habitacion: string | null }[];

    /**
     * Expedientes activos sin familiar registrado NI declaracion de que no lo
     * hay. No es una tarea del turno: es a quien no llamas de madrugada.
     *
     * Iba invisible. El 28-ago-2026 eran 19 de 32, con cero declaraciones, y
     * trece llevaban asi desde el restore del 21-may sin que nadie lo supiera.
     */
    sinContactoFamilia: { id: string; nombre: string }[];
}

export async function estadoOperativo(hqId: string): Promise<EstadoOperativo> {
    // Las DOS anclas del mismo dia clinico, que NO son intercambiables:
    //   inicioDia    = 10:00 UTC (6 AM AST). Para timestamps REALES —timeLogged,
    //                  createdAt—. Tres consultas de abajo lo usan asi, y bien.
    //   diaCalendario = 00:00 UTC del dia calendario. Para `ScheduledShift.date`,
    //                  que se persiste a medianoche UTC. Ver las ausencias.
    const inicioDia = todayStartAST();
    const diaCalendario = clinicalDayCalendarUTCRange();
    const hace14h = new Date(Date.now() - 14 * 3600 * 1000);
    const hace24h = new Date(Date.now() - 24 * 3600 * 1000);

    const [sesiones, activos, banos, comidas, vitales, hospital, alertas] = await Promise.all([
        prisma.shiftSession.findMany({
            where: { headquartersId: hqId, actualEndTime: null, startTime: { gte: hace14h } },
            select: {
                caregiverId: true, startTime: true,
                caregiver: { select: { name: true } },
            },
        }),
        prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE' },
            select: {
                id: true, name: true, roomNumber: true,
                sinFamiliarConocido: true,
                familyMembers: { select: { id: true } },
            },
        }),
        prisma.bathLog.findMany({
            where: { patient: { headquartersId: hqId }, timeLogged: { gte: inicioDia } },
            select: { patientId: true },
        }),
        prisma.mealLog.findMany({
            where: { patient: { headquartersId: hqId }, timeLogged: { gte: inicioDia } },
            select: { patientId: true },
        }),
        prisma.vitalSigns.findMany({
            where: { patient: { headquartersId: hqId }, createdAt: { gte: inicioDia } },
            select: { patientId: true },
        }),
        prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'TEMPORARY_LEAVE', leaveType: 'HOSPITAL' },
            select: { name: true, leaveDate: true },
        }),
        prisma.dailyLog.count({
            where: {
                patient: { headquartersId: hqId },
                isClinicalAlert: true, isResolved: false,
                createdAt: { gte: hace24h },
            },
        }),
    ]);

    // El color de cada quien sale del resolutor CANONICO, el mismo que usan
    // shift/preview y shift/end. No se reimplementa aqui.
    //
    // Su regla es que la cobertura REEMPLAZA a la pauta, no se le suma:
    //
    //     if (fromAssignments.length > 0) return fromAssignments;
    //     if (fromLegacy.length > 0)      return fromLegacy;
    //
    // Una primera version de este archivo las sumaba, y el dashboard mostraba a
    // Zuleyka cubriendo tres colores mientras el panel del supervisor mostraba
    // uno. El propio schema llama a ese error "D1 aditivo" y documenta que ya
    // se corrigio una vez —el campo ScheduledShift.releasedAt existe por eso—.
    // Reimplementar una regla que ya vive en otro sitio es como se vuelve a
    // caer en ella.
    /**
     * El MISMO resolvedor que el panel del supervisor, no otro parecido.
     *
     * Andres, 29-ago-2026: "mariangeliz esta en rojo y kristal en azul, a esa
     * incongruencia me refiero." Medido: el dashboard decia RED para las dos.
     *
     * Cuando arregle esta discrepancia la primera vez importe
     * resolveColorGroupsForCaregiver de shift-closure-report, dando por hecho
     * que era la fuente compartida. No lo era. El canonico es
     * resolveCaregiverColors de shift-coverage, que el panel del supervisor usa
     * con reglas escritas: D1 union de pauta y cobertura, D2 ventana por
     * compatibleShiftTypesAt, D3 limites del dia clinico, D4 fallback de
     * overtime. El otro tiene su propia ventana de medianoche UTC —que en AST
     * cae cuatro horas antes— y sin filtro de tipo de turno, asi que para
     * Krystal devolvia la pauta RED en vez de su cobertura BLUE.
     *
     * Dos funciones respondiendo la misma pregunta con reglas distintas no es
     * duplicacion: es que las pantallas se contradigan delante del director.
     */
    const { resolveCaregiverColors } = await import('@/lib/shift-coverage');
    const porUsuario = await resolveCaregiverColors({
        mode: 'batch',
        caregiverIds: sesiones.map(s => s.caregiverId),
        hqId,
        overtimeFallback: true,
    });

    // Ausencias del dia. El dato existia y no aparecia en ninguna pantalla del
    // director: habia que ir al constructor de horarios a buscarlo.
    //
    // Y SEGUIA sin aparecer, por el ancla. Esto filtraba `date: { gte: inicioDia }`,
    // y `inicioDia` son las 10:00 UTC mientras `ScheduledShift.date` se guarda a
    // las 00:00 UTC. Una fecha de 00:00 UTC no puede ser >= 10:00 UTC del mismo
    // dia: la consulta excluia ESTRUCTURALMENTE el dia en curso. Sin cota
    // superior, lo que devolvia eran las ausencias FUTURAS — no un cero, que se
    // habria notado, sino nombres de gente que falta la semana que viene bajo el
    // rotulo "ausencias de hoy".
    //
    // Medido en Cupey el 21-sep-2026, dia a dia sobre 120 dias. Los seis dias
    // con ausencia sin limpiar desde el 18-ago, y lo que el panel enseñaba:
    //
    //   dia      ancla vieja                 ancla correcta
    //   18-ago   6 lineas, ninguna del dia   1
    //   19-ago   5 lineas, ninguna del dia   1
    //   07-sep   4 lineas, ninguna del dia   1
    //   12-sep   3 lineas, ninguna del dia   1
    //   13-sep   1 linea,  no era del dia    2
    //   21-sep   0 lineas                    1
    //
    // Diecinueve lineas en total y NINGUNA era del dia que decia el rotulo:
    // eran las ausencias FUTURAS, gente que falta la semana siguiente. Un cero
    // se nota; una lista con nombres reales bajo "ausencias de hoy" no.
    //
    // El ancla que casa con este campo es `clinicalDayCalendarUTCRange()`, la
    // misma que usan shift-coverage, cuidadora-a-cargo y uncovered-colors contra
    // `ScheduledShift.date`. `inicioDia` se queda para timeLogged y createdAt.
    //
    // Y arreglar el ancla sola NO bastaba, porque destapaba dos filtros que
    // faltaban. Medido en Cupey el 21-sep-2026 sobre las 24 ausencias sin
    // limpiar que hay en toda la historia de la sede:
    //
    //   · `status: 'PUBLISHED'` — 1 de las 24 cuelga de un horario en BORRADOR
    //     (Yaileen Soto, 21-jul-2026). Un borrador es un ensayo del
    //     constructor de horarios; sus ausencias no son hechos. Los tres sitios
    //     que consultan `ScheduledShift.date` —shift-coverage,
    //     cuidadora-a-cargo, uncovered-colors— ya lo filtran; este no, y era la
    //     unica divergencia que quedaba con ellos.
    //
    //   · `user: activo y no borrado` — 17 de las 24 son de gente que ya no
    //     trabaja aqui (Joaneliz Rosario, Zuleyka Valcarcel, Medelyn Garcia,
    //     Eiby Caraballo...). Solo 7 son de personal vigente. Sin este filtro,
    //     arreglar el ancla cambiaba nombres futuros por nombres fantasma: HOY
    //     mismo, 21-sep, la unica linea bajo "ausencias de hoy" habria sido
    //     Joaneliz Rosario, cuya cuenta ya esta cerrada. Es el anti-patron que
    //     ya mordio en ulceras, riesgo de caidas, señales de personal y el
    //     leaderboard del wall.
    //
    //     OJO: "ya no trabaja aqui" NO quiere decir "se fue hace tiempo". Una
    //     version anterior de esta nota decia de Joaneliz "borrada desde hace
    //     meses" y era falso: cerro su ultimo turno el 20-sep, el dia antes de
    //     esta medicion, y todavia tiene un turno PAUTADO para el 27-sep. Las
    //     bajas de esta semana se ven igual que las de mayo porque `User` no
    //     guarda cuando se dieron: no hay `updatedAt` ni `deletedAt`, y cerrar
    //     una cuenta no escribe nada en la bitacora de auditoria.
    //
    // Que el numero puede moverse: el 07-sep da 1 (Mariangelie Rivera, activa)
    // y el 06-jul y el 03-jul dan 1 (Neylianne Torres). Hoy da 0 porque de
    // verdad no se ausento nadie de la plantilla vigente, no por construccion.
    const ausenciasHoy = await prisma.scheduledShift.findMany({
        where: {
            schedule: { headquartersId: hqId, status: 'PUBLISHED' },
            date: { gte: diaCalendario.start, lt: diaCalendario.end },
            isAbsent: true,
            absentClearedAt: null,
            user: { isActive: true, isDeleted: false },
        },
        select: {
            absenceReason: true, absenceNotified: true,
            user: { select: { name: true } },
        },
    });

    // Rotaciones vencidas — misma definicion que el panel del supervisor.
    const { rotacionVencida } = await import('@/lib/rotacion-upp');
    const conUlcera = await prisma.patient.findMany({
        where: { headquartersId: hqId, status: 'ACTIVE', pressureUlcers: { some: { status: 'ACTIVE' } } },
        select: {
            posturalChanges: { orderBy: { performedAt: 'desc' }, take: 1, select: { performedAt: true } },
        },
    });

    // El numerador tiene que ser la MISMA poblacion que el denominador.
    // Sin esto salia "34/33": un residente en licencia hospitalaria contaba en
    // los banos pero no entre los activos. Un progreso que pasa del 100% no
    // es un progreso, es un error de conteo.
    const idsActivos = new Set(activos.map(p => p.id));
    const soloActivos = (ids: string[]) => new Set(ids.filter(id => idsActivos.has(id)));

    const conBano = soloActivos(banos.map(b => b.patientId));
    const conComida = soloActivos(comidas.map(m => m.patientId));
    const conVital = soloActivos(vitales.map(v => v.patientId));
    const conAlgo = new Set([...conBano, ...conComida, ...conVital]);

    return {
        enTurno: sesiones.map(s => ({
            caregiverId: s.caregiverId,
            nombre: s.caregiver.name.trim(),
            colores: porUsuario.get(s.caregiverId) ?? [],
            desde: s.startTime,
        })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),

        ausencias: ausenciasHoy.map(a => ({
            nombre: a.user.name.trim(),
            motivo: a.absenceReason,
            aviso: a.absenceNotified,
        })),

        corriendo: {
            enHospital: hospital.map(h => ({ nombre: h.name.trim(), desde: h.leaveDate })),
            alertasAbiertas: alertas,
            rotacionesVencidas: conUlcera.filter(p => rotacionVencida(p.posturalChanges[0]?.performedAt)).length,
        },

        // Sobre residentes activos, no en absoluto: "35 baños" no dice nada;
        // "35 de 33" dice que hoy se cubrio a todo el mundo y hubo repeticiones.
        progreso: {
            banos: { hecho: conBano.size, total: activos.length },
            comidas: { hecho: conComida.size, total: activos.length },
            vitales: { hecho: conVital.size, total: activos.length },
        },

        sinContactoFamilia: activos
            .filter((p: any) => (p.familyMembers?.length ?? 0) === 0 && !p.sinFamiliarConocido)
            .map((p: any) => ({ id: p.id, nombre: p.name.trim() }))
            .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, 'es')),

        sinActividad: activos
            .filter(p => !conAlgo.has(p.id))
            .map(p => ({ id: p.id, nombre: p.name.trim(), habitacion: p.roomNumber })),
    };
}
