/**
 * Encuesta trimestral de servicio a las familias.
 *
 * POR QUE POR CORREO Y NO SOLO EN EL PORTAL
 *
 * De 19 familiares en Cupey, los 19 tienen correo y solo 15 completaron su
 * acceso al portal. Una encuesta que viva unicamente dentro del portal
 * renuncia de entrada a cuatro familias — y probablemente a mas, porque el
 * portal tampoco se abre a diario.
 *
 * El enlace lleva un codigo unico y se responde sin iniciar sesion, igual que
 * la verificacion de certificados. Un paso menos entre la familia y la
 * respuesta.
 *
 * LA FILA SE CREA AL INVITAR, NO AL RESPONDER
 *
 * Asi se puede medir la tasa de respuesta, que es tan informativa como las
 * notas: si de 19 contestan 3, el promedio de esas 3 no dice nada del hogar.
 * Sin invitaciones registradas, un 4.8 de dos respuestas parece un exito.
 *
 * IDENTIFICADA, por decision de Andres. Tiene una consecuencia que conviene
 * asumir: las notas suben cuando quien responde sabe que se le reconoce. A
 * cambio, una queja concreta se puede atender con nombre y apellido, que es
 * justo lo que un hogar de 33 residentes necesita.
 */
import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';

const ALFABETO = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** Trimestre actual en hora de Puerto Rico, formato "2026-Q3". */
export function periodoActual(fecha = new Date()): string {
    const pr = new Date(fecha.getTime() - 4 * 3600 * 1000);
    const anio = pr.getUTCFullYear();
    const trimestre = Math.floor(pr.getUTCMonth() / 3) + 1;
    return `${anio}-Q${trimestre}`;
}

function generarToken(): string {
    let s = '';
    for (let i = 0; i < 10; i++) s += ALFABETO[randomInt(ALFABETO.length)];
    return s;
}

export interface ResultadoEnvio {
    periodo: string;
    creadas: number;
    yaExistian: number;
    sinCorreo: number;
    invitaciones: { familyMemberId: string; nombre: string; email: string; token: string }[];
}

/**
 * Prepara las invitaciones del trimestre para una sede.
 *
 * NO manda correos: devuelve las invitaciones para que quien llame decida como
 * enviarlas. Separar preparar de enviar permite ver a quien le va a llegar
 * antes de que salga nada.
 *
 * Idempotente por trimestre: el indice unico (familyMemberId, periodo) impide
 * invitar dos veces a la misma familia en el mismo trimestre.
 */
export async function prepararEnvio(hqId: string, periodo = periodoActual()): Promise<ResultadoEnvio> {
    const familiares = await prisma.familyMember.findMany({
        where: {
            headquartersId: hqId,
            // Solo familias de residentes que siguen en el hogar. Preguntarle
            // por el servicio a quien perdio a su madre en junio no es una
            // encuesta, es una torpeza.
            patient: { status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
        },
        select: { id: true, name: true, email: true },
    });

    const yaInvitados = new Set(
        (await prisma.familySurvey.findMany({
            where: { headquartersId: hqId, periodo },
            select: { familyMemberId: true },
        })).map(x => x.familyMemberId),
    );

    const invitaciones: ResultadoEnvio['invitaciones'] = [];
    let creadas = 0, yaExistian = 0, sinCorreo = 0;

    for (const f of familiares) {
        if (yaInvitados.has(f.id)) { yaExistian++; continue; }
        if (!f.email || !f.email.includes('@')) { sinCorreo++; continue; }

        const token = generarToken();
        await prisma.familySurvey.create({
            data: {
                headquartersId: hqId,
                familyMemberId: f.id,
                periodo,
                token,
                sentAt: new Date(),
            },
        });
        creadas++;
        invitaciones.push({ familyMemberId: f.id, nombre: f.name.trim(), email: f.email, token });
    }

    return { periodo, creadas, yaExistian, sinCorreo, invitaciones };
}

export interface Satisfaccion {
    periodo: string;
    enviadas: number;
    respondidas: number;
    tasaRespuesta: number;
    promedio: number | null;
    porDimension: { cuidado: number | null; limpieza: number | null; salud: number | null };
    /** Respuestas de 3 o menos en cualquier dimension. Son las que piden accion. */
    conAlerta: { nombre: string; residente: string; promedio: number; comentario: string | null }[];
}

/** Satisfaccion de una sede en un trimestre. */
export async function satisfaccion(hqId: string, periodo = periodoActual()): Promise<Satisfaccion> {
    const filas = await prisma.familySurvey.findMany({
        where: { headquartersId: hqId, periodo },
        select: {
            ratingCare: true, ratingClean: true, ratingHealth: true,
            respondedAt: true, comentario: true,
            familyMember: { select: { name: true, patient: { select: { name: true } } } },
        },
    });

    const respondidas = filas.filter(f => f.respondedAt !== null);
    const media = (xs: (number | null)[]) => {
        const v = xs.filter((x): x is number => x != null);
        return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };

    const cuidado = media(respondidas.map(f => f.ratingCare));
    const limpieza = media(respondidas.map(f => f.ratingClean));
    const salud = media(respondidas.map(f => f.ratingHealth));
    const todas = [cuidado, limpieza, salud].filter((x): x is number => x != null);

    return {
        periodo,
        enviadas: filas.length,
        respondidas: respondidas.length,
        tasaRespuesta: filas.length ? Math.round((respondidas.length / filas.length) * 100) : 0,
        promedio: todas.length ? Math.round((todas.reduce((a, b) => a + b, 0) / todas.length) * 10) / 10 : null,
        porDimension: { cuidado, limpieza, salud },
        conAlerta: respondidas
            .filter(f => [f.ratingCare, f.ratingClean, f.ratingHealth].some(r => r != null && r <= 3))
            .map(f => ({
                nombre: f.familyMember.name.trim(),
                residente: f.familyMember.patient.name.trim(),
                promedio: media([f.ratingCare, f.ratingClean, f.ratingHealth]) ?? 0,
                comentario: f.comentario,
            }))
            .sort((a, b) => a.promedio - b.promedio),
    };
}
