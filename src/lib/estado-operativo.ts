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
import { todayStartAST } from '@/lib/dates';

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
}

export async function estadoOperativo(hqId: string): Promise<EstadoOperativo> {
    const inicioDia = todayStartAST();
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
            select: { id: true, name: true, roomNumber: true },
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

    // Color que cubre cada quien hoy. Son DOS fuentes: la pauta del horario
    // (ScheduledShift.colorGroup) y las coberturas puntuales
    // (ShiftColorAssignment). Mirar solo la segunda dejaba a todo el mundo "sin
    // color", porque la mayoria de los dias nadie necesita cobertura extra.
    //
    // Una pauta liberada (releasedAt) deja de contar como color de esa persona.
    const [pautas, coberturas] = await Promise.all([
        prisma.scheduledShift.findMany({
            where: {
                schedule: { headquartersId: hqId },
                date: { gte: inicioDia },
                isAbsent: false,
                releasedAt: null,
                colorGroup: { not: null },
            },
            select: { userId: true, colorGroup: true },
        }),
        prisma.shiftColorAssignment.findMany({
            where: { headquartersId: hqId, assignedAt: { gte: inicioDia } },
            select: { userId: true, color: true },
        }),
    ]);
    const porUsuario = new Map<string, string[]>();
    const anotar = (userId: string, color: string | null) => {
        if (!color) return;
        const l = porUsuario.get(userId) ?? [];
        if (!l.includes(color)) l.push(color);
        porUsuario.set(userId, l);
    };
    pautas.forEach(p => anotar(p.userId, p.colorGroup));
    coberturas.forEach(c => anotar(c.userId, c.color));

    // Ausencias del dia. El dato existia y no aparecia en ninguna pantalla del
    // director: habia que ir al constructor de horarios a buscarlo.
    const ausenciasHoy = await prisma.scheduledShift.findMany({
        where: {
            schedule: { headquartersId: hqId },
            date: { gte: inicioDia },
            isAbsent: true,
            absentClearedAt: null,
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

        sinActividad: activos
            .filter(p => !conAlgo.has(p.id))
            .map(p => ({ id: p.id, nombre: p.name.trim(), habitacion: p.roomNumber })),
    };
}
