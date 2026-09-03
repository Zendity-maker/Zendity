/**
 * ACUERDOS DE SEDE — BAA Y CONTRATO DE SERVICIO
 * ─────────────────────────────────────────────
 * Zéndity procesa PHI de residentes que pertenecen al hogar. Bajo HIPAA eso
 * exige un BAA firmado ANTES de tocar el primer expediente — no después, no
 * "cuando se pueda". Por eso el candado es estricto: sin BAA aceptado no se
 * puede crear el primer residente de una sede.
 *
 * La decisión se tomó el 03-sep-2026. El argumento para el estricto: en el
 * momento del alta nadie tiene prisa todavía, y es cuando el hogar está más
 * dispuesto a leer lo que firma. Un aviso permanente se convierte en parte del
 * paisaje en dos semanas — lo vimos con todo lo demás esta semana.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { textoBAA, BAA_VERSION, type DatosBAA } from '@/lib/baa-texto';

export type TipoAcuerdo = 'BAA' | 'SERVICIO';

/** Hash del texto exacto que se le mostró. Constancia de QUÉ versión aceptó. */
export function hashContenido(texto: string): string {
    return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

/** El texto plano del BAA, para hashear y para mostrar. */
export function baaPlano(d: DatosBAA): string {
    const doc = textoBAA(d);
    return [doc.titulo, ...doc.secciones.map(s => `${s.titulo}\n${s.cuerpo}`)].join('\n\n');
}

/** ¿Esta sede tiene el BAA aceptado y vigente? */
export async function tieneBAAaceptado(hqId: string): Promise<boolean> {
    const acuerdo = await prisma.acuerdoSede.findFirst({
        where: { headquartersId: hqId, tipo: 'BAA', aceptadoEn: { not: null } },
        select: { id: true },
    });
    return !!acuerdo;
}

/**
 * Candado estricto para crear residentes. Devuelve null si puede seguir, o el
 * mensaje que hay que mostrarle si no.
 *
 * El mensaje explica POR QUÉ y A DÓNDE ir. Un bloqueo que solo dice "no
 * autorizado" convierte una obligación legal en un error de sistema, y quien lo
 * recibe llama a soporte en vez de ir a firmar.
 */
export async function bloqueoPorBAA(hqId: string): Promise<string | null> {
    if (await tieneBAAaceptado(hqId)) return null;
    return 'Esta sede aún no tiene firmado el Acuerdo de Asociado Comercial (BAA). '
        + 'Zéndity no puede recibir información de salud de un residente sin ese acuerdo: '
        + 'es un requisito de HIPAA y protege tanto al hogar como al residente. '
        + 'El director lo firma en el menú lateral, en Acuerdos. Toma un minuto.';
}

/** Crea las filas pendientes de aceptación al dar de alta una sede. */
export async function crearAcuerdosPendientes(hqId: string, hqNombre: string, hqDireccion?: string | null) {
    const texto = baaPlano({ hqNombre, hqDireccion });
    // (servicioDesde se resuelve al mostrar y al firmar, desde Headquarters.createdAt)
    await prisma.acuerdoSede.upsert({
        where: { headquartersId_tipo_version: { headquartersId: hqId, tipo: 'BAA', version: BAA_VERSION } },
        update: {},
        create: {
            headquartersId: hqId,
            tipo: 'BAA',
            version: BAA_VERSION,
            contenidoHash: hashContenido(texto),
        },
    });
}
