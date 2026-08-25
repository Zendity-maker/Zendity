/**
 * Códigos de certificado de Academy — emisión y verificación.
 *
 * Antes el certificado se dibujaba entero en el navegador a partir de tres
 * textos (nombre, curso, fecha), con la fecha del día en que se pulsaba
 * imprimir en vez de la de aprobación, y sin dejar rastro de nada: el campo
 * UserCourse.certificateUrl existía en el schema y no se escribía ni se leía
 * en ninguna parte. Un papel bonito que no probaba nada.
 *
 * Ahora el código se emite UNA vez, en el servidor, contra el registro real de
 * aprobación, y queda guardado. El PDF deja de ser la prueba y pasa a ser la
 * copia: quien quiera comprobarlo teclea el código en /verificar y lee la
 * fuente, no el papel.
 *
 * FORMATO   ZEN-2026-K7F3M2
 *
 * Aleatorio y no correlativo a propósito. Un ZEN-000001 le dice a cualquiera
 * cuántos certificados has emitido y permite adivinar el siguiente; con eso
 * se puede "verificar" un certificado que nunca existió.
 *
 * El alfabeto excluye 0/O, 1/I/L y U — los que se confunden al leer un código
 * escrito a mano o dictado por teléfono. Quedan 30 símbolos: 30^6 = 729
 * millones de combinaciones por año, de sobra para que adivinar uno sea
 * inviable y los choques prácticamente imposibles.
 */
import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';

const ALFABETO = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const LARGO = 6;

/** Genera un código nuevo. No comprueba unicidad — de eso se encarga emitirCodigo. */
export function generarCodigo(anio = new Date().getFullYear()): string {
    let cuerpo = '';
    for (let i = 0; i < LARGO; i++) {
        cuerpo += ALFABETO[randomInt(ALFABETO.length)];
    }
    return `ZEN-${anio}-${cuerpo}`;
}

/** Normaliza lo que teclea una persona: espacios, minúsculas, guiones de más. */
export function normalizarCodigo(entrada: string): string {
    const limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Acepta que lo peguen con o sin guiones: ZEN2026K7F3M2 y ZEN-2026-K7F3M2.
    const m = limpio.match(/^ZEN(\d{4})([A-Z0-9]{6})$/);
    return m ? `ZEN-${m[1]}-${m[2]}` : entrada.trim().toUpperCase();
}

export const FORMATO_VALIDO = /^ZEN-\d{4}-[A-Z0-9]{6}$/;

/**
 * Devuelve el código del certificado, emitiéndolo si aún no tenía.
 *
 * Idempotente: llamarlo diez veces devuelve siempre el mismo código. Emitir
 * uno nuevo en cada impresión haría que dos copias del mismo certificado no
 * coincidieran, que es justo lo contrario de verificable.
 *
 * Solo emite si el curso está aprobado. Un certificado de un curso sin
 * aprobar no debe existir ni siquiera como código.
 */
export async function emitirCodigo(userCourseId: string): Promise<string | null> {
    const uc = await prisma.userCourse.findUnique({
        where: { id: userCourseId },
        select: { id: true, status: true, certificateCode: true, completedAt: true },
    });
    if (!uc || uc.status !== 'COMPLETED') return null;
    if (uc.certificateCode) return uc.certificateCode;

    const anio = (uc.completedAt ?? new Date()).getFullYear();

    // Reintentos por si el @unique choca. Con 729 millones por año es
    // prácticamente imposible, pero un choque silencioso emitiría el código de
    // otra persona y eso no puede pasar nunca.
    for (let intento = 0; intento < 5; intento++) {
        const codigo = generarCodigo(anio);
        try {
            // updateMany y no update: Prisma 5.22 no admite filtros no únicos
            // en update, y el `certificateCode: null` es lo que evita pisar un
            // código ya emitido si dos peticiones llegan a la vez. El count
            // dice si ganamos la carrera.
            const r = await prisma.userCourse.updateMany({
                where: { id: userCourseId, certificateCode: null },
                data: { certificateCode: codigo, certificateIssuedAt: new Date() },
            });
            if (r.count === 1) return codigo;
            const yaTiene = await prisma.userCourse.findUnique({
                where: { id: userCourseId },
                select: { certificateCode: true },
            });
            if (yaTiene?.certificateCode) return yaTiene.certificateCode;
        } catch {
            // O chocó el código, o alguien lo emitió entre el findUnique y el
            // update. Releer: si ya tiene código, ese es el bueno.
            const ahora = await prisma.userCourse.findUnique({
                where: { id: userCourseId },
                select: { certificateCode: true },
            });
            if (ahora?.certificateCode) return ahora.certificateCode;
        }
    }
    return null;
}


/**
 * Emite (o devuelve) el codigo del certificado MAESTRO.
 *
 * Solo si la persona aprobo TODOS los cursos activos que le aplican. El
 * maestro es el que mas pesa, asi que es el que menos puede emitirse a la
 * ligera: si se pudiera imprimir sin comprobar, seria el eslabon falsificable
 * de toda la cadena.
 */
export async function emitirCodigoMaestro(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, headquartersId: true, masterCertCode: true, masterCertRevokedAt: true },
    });
    if (!user || user.masterCertRevokedAt) return null;
    if (user.masterCertCode) return user.masterCertCode;

    const [totalCursos, aprobados] = await Promise.all([
        prisma.course.count({ where: { headquartersId: user.headquartersId, isActive: true } }),
        prisma.userCourse.count({ where: { employeeId: userId, status: 'COMPLETED' } }),
    ]);
    if (totalCursos === 0 || aprobados < totalCursos) return null;

    for (let intento = 0; intento < 5; intento++) {
        const codigo = generarCodigo();
        try {
            const r = await prisma.user.updateMany({
                where: { id: userId, masterCertCode: null },
                data: { masterCertCode: codigo, masterCertIssuedAt: new Date() },
            });
            if (r.count === 1) return codigo;
            const ya = await prisma.user.findUnique({ where: { id: userId }, select: { masterCertCode: true } });
            if (ya?.masterCertCode) return ya.masterCertCode;
        } catch {
            const ya = await prisma.user.findUnique({ where: { id: userId }, select: { masterCertCode: true } });
            if (ya?.masterCertCode) return ya.masterCertCode;
        }
    }
    return null;
}


export interface CertificadoVerificado {
    valido: boolean;
    motivo?: 'FORMATO' | 'NO_EXISTE' | 'REVOCADO';
    codigo: string;
    tipo?: 'CURSO' | 'MAESTRO';
    nombre?: string;
    curso?: string;
    duracionMin?: number;
    aprobadoEl?: Date | null;
    emitidoEl?: Date | null;
    revocadoEl?: Date | null;
    sede?: string;
}

/**
 * Busca un certificado por su codigo. Unica fuente para la pagina publica y
 * para el endpoint: duplicar esta logica en dos sitios acabaria en que uno
 * diga valido y el otro no.
 *
 * Mira primero los certificados de curso y luego el maestro. Un codigo que no
 * existe y uno con formato malo devuelven la misma forma de respuesta a
 * proposito: distinguirlos le diria a quien prueba codigos cuando se acerca.
 */
export async function buscarCertificado(entrada: string): Promise<CertificadoVerificado> {
    const codigo = normalizarCodigo(entrada);
    if (!FORMATO_VALIDO.test(codigo)) return { valido: false, motivo: 'FORMATO', codigo };

    const uc = await prisma.userCourse.findUnique({
        where: { certificateCode: codigo },
        select: {
            status: true,
            completedAt: true,
            certificateIssuedAt: true,
            certificateRevokedAt: true,
            employee: { select: { name: true } },
            course: { select: { title: true, durationMins: true } },
            headquarters: { select: { name: true } },
        },
    });

    if (uc) {
        if (uc.status !== 'COMPLETED') return { valido: false, motivo: 'NO_EXISTE', codigo };
        if (uc.certificateRevokedAt) {
            return {
                valido: false, motivo: 'REVOCADO', codigo, tipo: 'CURSO',
                nombre: uc.employee.name, curso: uc.course.title,
                revocadoEl: uc.certificateRevokedAt,
            };
        }
        return {
            valido: true, codigo, tipo: 'CURSO',
            nombre: uc.employee.name,
            curso: uc.course.title,
            duracionMin: uc.course.durationMins,
            aprobadoEl: uc.completedAt,
            emitidoEl: uc.certificateIssuedAt,
            sede: uc.headquarters.name,
        };
    }

    const maestro = await prisma.user.findUnique({
        where: { masterCertCode: codigo },
        select: {
            name: true,
            masterCertIssuedAt: true,
            masterCertRevokedAt: true,
            headquarters: { select: { name: true } },
        },
    });

    if (!maestro) return { valido: false, motivo: 'NO_EXISTE', codigo };

    if (maestro.masterCertRevokedAt) {
        return {
            valido: false, motivo: 'REVOCADO', codigo, tipo: 'MAESTRO',
            nombre: maestro.name, curso: 'Personal Adiestrado en Zendity',
            revocadoEl: maestro.masterCertRevokedAt,
        };
    }

    return {
        valido: true, codigo, tipo: 'MAESTRO',
        nombre: maestro.name,
        curso: 'Personal Adiestrado en Zendity',
        aprobadoEl: maestro.masterCertIssuedAt,
        emitidoEl: maestro.masterCertIssuedAt,
        sede: maestro.headquarters?.name,
    };
}
