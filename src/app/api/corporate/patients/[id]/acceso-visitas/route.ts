/**
 * ACCESO DE VISITAS DE UN RESIDENTE
 * ─────────────────────────────────
 * Las dos listas —autorizados y no autorizados— y el interruptor de modo
 * estricto. Vive en el perfil del residente porque es donde se mira cuando
 * pasa algo en recepción.
 *
 * SOLO DIRECTOR Y ADMIN. Detrás de "esta persona no entra" suele haber una
 * orden judicial o una decisión de familia; no es una preferencia operativa
 * que ajuste quien esté de turno. Enfermería y supervisión lo LEEN —lo
 * necesitan cuando el aviso les llega a la tablet— pero no lo cambian.
 *
 * NADA SE BORRA, SE REVOCA. Quién puso a alguien en una lista, quién lo quitó
 * y cuándo son parte del expediente: en seis meses alguien va a preguntar quién
 * lo decidió, y "ya no está en la lista" no es una respuesta.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const LEER = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'SOCIAL_WORKER'];
const ESCRIBIR = ['DIRECTOR', 'ADMIN'];
const TIPOS = ['AUTORIZADO', 'NO_AUTORIZADO'];

async function residenteDeLaSede(id: string, hqId: string) {
    return prisma.patient.findFirst({
        where: { id, headquartersId: hqId },
        select: { id: true, name: true, visitasRestringidas: true, visitasRestringidasMotivo: true },
    });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(LEER);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const paciente = await residenteDeLaSede(id, auth.headquartersId);
    if (!paciente) {
        return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
    }

    const lista = await prisma.visitanteAutorizado.findMany({
        where: { patientId: id, activo: true, revocadoAt: null },
        select: { id: true, tipo: true, nombre: true, relacion: true, telefono: true, notas: true, createdAt: true },
        orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });

    return NextResponse.json({
        success: true,
        estricto: paciente.visitasRestringidas,
        motivo: paciente.visitasRestringidasMotivo,
        autorizados: lista.filter(v => v.tipo === 'AUTORIZADO'),
        noAutorizados: lista.filter(v => v.tipo === 'NO_AUTORIZADO'),
        puedeEditar: ESCRIBIR.includes(auth.role),
    });
}

/** Añade una persona a una de las listas. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(ESCRIBIR);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const paciente = await residenteDeLaSede(id, auth.headquartersId);
    if (!paciente) {
        return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const nombre = String(body.nombre ?? '').trim();
    const tipo = String(body.tipo ?? '');

    if (!nombre) {
        return NextResponse.json({ success: false, error: 'Falta el nombre' }, { status: 400 });
    }
    if (!TIPOS.includes(tipo)) {
        return NextResponse.json({ success: false, error: `Tipo inválido. Válidos: ${TIPOS.join(', ')}` }, { status: 400 });
    }

    const creado = await prisma.visitanteAutorizado.create({
        data: {
            headquartersId: auth.headquartersId,
            patientId: id,
            tipo,
            nombre,
            relacion: String(body.relacion ?? '').trim() || null,
            telefono: String(body.telefono ?? '').trim() || null,
            notas: String(body.notas ?? '').trim() || null,
            creadoPorId: auth.id,
        },
        select: { id: true, tipo: true, nombre: true },
    });

    return NextResponse.json({ success: true, entrada: creado });
}

/**
 * Enciende o apaga el modo estricto, o revoca una entrada.
 *
 * `accion: 'ESTRICTO'` con `activo: true|false`, o `accion: 'REVOCAR'` con
 * `entradaId`.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(ESCRIBIR);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const paciente = await residenteDeLaSede(id, auth.headquartersId);
    if (!paciente) {
        return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    if (body.accion === 'REVOCAR') {
        const { count } = await prisma.visitanteAutorizado.updateMany({
            // El patientId va en el WHERE: una entrada de otro residente no
            // encuentra fila en vez de dar un 403 que confirma que existe.
            where: { id: String(body.entradaId ?? ''), patientId: id, revocadoAt: null },
            data: { activo: false, revocadoAt: new Date(), revocadoPorId: auth.id },
        });
        if (count === 0) {
            return NextResponse.json({ success: false, error: 'Entrada no encontrada o ya revocada' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    }

    if (body.accion === 'ESTRICTO') {
        const encender = body.activo === true;

        /**
         * No se puede encender el estricto con la lista vacía.
         *
         * Sería la trampa perfecta: el interruptor queda puesto, la lista sin
         * nadie, y TODAS las visitas de ese residente empiezan a quedar en
         * espera sin que nadie entienda por qué. Quien lo enciende cree que ha
         * restringido; en realidad ha aislado.
         */
        if (encender) {
            const cuantos = await prisma.visitanteAutorizado.count({
                where: { patientId: id, tipo: 'AUTORIZADO', activo: true, revocadoAt: null },
            });
            if (cuantos === 0) {
                return NextResponse.json({
                    success: false,
                    error: 'Añade al menos una persona a la lista de autorizados antes de activar el modo estricto. Si no, ninguna visita podría pasar.',
                }, { status: 400 });
            }
        }

        await prisma.patient.update({
            where: { id },
            data: {
                visitasRestringidas: encender,
                visitasRestringidasMotivo: encender ? (String(body.motivo ?? '').trim() || null) : null,
            },
        });
        return NextResponse.json({ success: true, estricto: encender });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
}
