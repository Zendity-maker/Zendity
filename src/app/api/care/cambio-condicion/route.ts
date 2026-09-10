/**
 * LO QUE EL PISO NOTA QUE CAMBIÓ
 * ──────────────────────────────
 * POST reporta. GET lista lo que espera revisión.
 *
 * El porqué completo está en src/lib/cambios-de-condicion.ts y en el modelo.
 * En corto: la tableta tenía botón para lo que se repite y para lo grave, y
 * nada para lo que cambió sin ser todavía una emergencia. Eso terminaba en una
 * nota de turno que nadie relee.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyRoles } from '@/lib/notifications';
import {
    esAreaValida, etiquetaArea, etiquetaResultado,
    PUEDEN_REPORTAR_CAMBIO, PUEDEN_REVISAR_CAMBIO,
    detectarPatrones,
} from '@/lib/cambios-de-condicion';

export const dynamic = 'force-dynamic';

/** Suficiente para decir qué se vio. Menos que esto no es un reporte. */
const MINIMO_DESCRIPCION = 15;

export async function POST(req: Request) {
    const auth = await requireRole(PUEDEN_REPORTAR_CAMBIO);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json().catch(() => ({}));
        const patientId = String(body.patientId ?? '').trim();
        const area = String(body.area ?? '').trim();
        const descripcion = String(body.descripcion ?? '').trim();

        if (!patientId) {
            return NextResponse.json({ success: false, error: 'Falta el residente' }, { status: 400 });
        }
        if (!esAreaValida(area)) {
            return NextResponse.json({ success: false, error: 'Elija qué cambió' }, { status: 400 });
        }
        if (descripcion.length < MINIMO_DESCRIPCION) {
            return NextResponse.json({
                success: false,
                error: `Describa qué vio — al menos ${MINIMO_DESCRIPCION} caracteres.`,
            }, { status: 400 });
        }

        // hqId SIEMPRE de la sesión, nunca del body.
        const paciente = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: auth.headquartersId },
            select: { id: true, name: true },
        });
        if (!paciente) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        const cambio = await prisma.cambioDeCondicion.create({
            data: {
                headquartersId: auth.headquartersId,
                patientId,
                reportadoPorId: auth.id,
                area,
                descripcion: descripcion.slice(0, 2000),
            },
            select: { id: true, reportadoAt: true },
        });

        /**
         * El aviso llega ahora; el contador insiste después. Los dos hacen
         * falta y hacen cosas distintas: una notificación se lee una vez y se
         * va, y así fue como dos observaciones de personal se quedaron 56 y 45
         * días paradas habiendo disparado la suya.
         */
        notifyRoles(auth.headquartersId, PUEDEN_REVISAR_CAMBIO, {
            type: 'TRIAGE',
            title: `${etiquetaArea(area)} — ${paciente.name.trim()}`,
            message: `${auth.name ?? 'Personal'} reportó un cambio: ${descripcion.slice(0, 160)}`,
            link: '/care/cambios',
        }, auth.id).catch(e => console.error('Aviso de cambio de condición:', e));

        return NextResponse.json({
            success: true,
            id: cambio.id,
            mensaje: 'Queda reportado. Enfermería lo va a revisar.',
        });
    } catch (error) {
        console.error('Cambio de condición POST:', error);
        return NextResponse.json({ success: false, error: 'No se pudo reportar' }, { status: 500 });
    }
}

/**
 * GET — lo que espera revisión, lo más viejo primero.
 *
 * `?historial=<patientId>` devuelve el historial de un residente, cerrados
 * incluidos: quien va a decidir necesita saber si esto ya se reportó antes.
 */
export async function GET(req: Request) {
    const auth = await requireRole(PUEDEN_REVISAR_CAMBIO);
    if (auth instanceof NextResponse) return auth;

    try {
        const url = new URL(req.url);
        const historialDe = url.searchParams.get('historial');

        const cambios = await prisma.cambioDeCondicion.findMany({
            where: {
                headquartersId: auth.headquartersId,
                ...(historialDe ? { patientId: historialDe } : { revisadoAt: null }),
            },
            select: {
                id: true, area: true, descripcion: true, reportadoAt: true,
                reportadoPorId: true, revisadoAt: true, revisadoPorId: true,
                resultado: true, respuesta: true,
                patientId: true,
                // colorGroup para el detector de patrones: "todos del grupo BLUE"
                // es la pista, no el número.
                patient: { select: { id: true, name: true, roomNumber: true, colorGroup: true } },
            },
            orderBy: { reportadoAt: historialDe ? 'desc' : 'asc' },
            take: 100,
        });

        // Los ids de personal se resuelven a nombres en una sola consulta —
        // el modelo los guarda sueltos, como Patient.fallecimientoReportadoPorId.
        const ids = [...new Set(cambios.flatMap(c => [c.reportadoPorId, c.revisadoPorId].filter(Boolean) as string[]))];
        const personas = ids.length
            ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
            : [];
        const nombre = new Map(personas.map(p => [p.id, p.name ?? 'Personal']));

        /**
         * Los patrones se calculan aquí, no en la pantalla: el mismo detector
         * lo usan los pendientes de enfermería y el reporte de dirección, y una
         * regla clínica repetida en tres sitios acaba divergiendo en tres.
         *
         * Solo sobre lo que está SIN revisar (historialDe trae el historial de
         * un residente, y ahí un patrón no significa nada).
         */
        const patrones = historialDe ? [] : detectarPatrones(cambios as any);

        return NextResponse.json({
            success: true,
            patrones: patrones.map(p => ({
                area: p.area,
                areaEtiqueta: etiquetaArea(p.area),
                cuantos: p.residentes.length,
                enComun: p.enComun,
                residentes: p.residentes,
            })),
            cambios: cambios.map(c => ({
                id: c.id,
                area: c.area,
                areaEtiqueta: etiquetaArea(c.area),
                descripcion: c.descripcion,
                reportadoAt: c.reportadoAt,
                reportadoPor: nombre.get(c.reportadoPorId) ?? 'Personal',
                diasEsperando: Math.floor((Date.now() - c.reportadoAt.getTime()) / 86400000),
                revisadoAt: c.revisadoAt,
                revisadoPor: c.revisadoPorId ? nombre.get(c.revisadoPorId) ?? 'Personal' : null,
                resultado: c.resultado,
                resultadoEtiqueta: etiquetaResultado(c.resultado),
                respuesta: c.respuesta,
                residente: { id: c.patient.id, nombre: c.patient.name.trim(), habitacion: c.patient.roomNumber },
            })),
        });
    } catch (error) {
        console.error('Cambio de condición GET:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
