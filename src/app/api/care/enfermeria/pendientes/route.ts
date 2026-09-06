/**
 * LO QUE LE TOCA A ENFERMERÍA HOY
 * ───────────────────────────────
 * Una sola consulta con todo lo que espera una decisión de enfermería, cada
 * cosa con su número y su enlace.
 *
 * POR QUÉ. El trabajo de enfermería vive repartido entre /care/nursing,
 * /care/vitals, /care/supervisor, /med, /cuidadores, /care/cambios y tres
 * pestañas dentro de /corporate/medical. Ninguna de esas pantallas dice qué
 * hace falta hacer: cada una enseña su parcela y hay que entrar a las siete
 * para saber si hay algo pendiente. Quien no sabe que hay algo pendiente no
 * entra a comprobarlo — es la misma razón por la que 16 PAI completos llevaban
 * 106 días sin firmar y dos observaciones de personal 56 y 45 días paradas.
 *
 * TODO SE CALCULA CONTRA LA REALIDAD. Nada de esto se marca a mano como hecho:
 * cada número sale de una consulta y desaparece solo cuando la cosa se
 * resuelve de verdad. Una lista que se pueda tachar sin hacer el trabajo es
 * peor que no tenerla.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { HORAS_PARA_EXIGIR_EFECTO } from '@/lib/prn';
import { PUEDEN_REVISAR_CAMBIO } from '@/lib/cambios-de-condicion';

export const dynamic = 'force-dynamic';

/** Igual que ULCERA_SIN_SEGUIMIENTO en src/lib/verificaciones.ts. */
const DIAS_SIN_CURACION = 7;
/** Igual que el tier OVERDUE de /api/care/nursing/rotation. */
const MINUTOS_ROTACION_VENCIDA = 135;

export interface Pendiente {
    codigo: string;
    titulo: string;
    /** Qué pasa si nadie lo mira. En una línea. */
    detalle: string;
    total: number;
    urgencia: 'ALTA' | 'MEDIA' | 'BAJA';
    href: string;
}

export async function GET() {
    const auth = await requireRole(PUEDEN_REVISAR_CAMBIO);
    if (auth instanceof NextResponse) return auth;
    const hqId = auth.headquartersId;

    try {
        const ahora = Date.now();
        const limiteCuracion = new Date(ahora - DIAS_SIN_CURACION * 86400000);
        const limitePRN = new Date(ahora - HORAS_PARA_EXIGIR_EFECTO * 3600000);

        const [ulceras, prnSinRespuesta, cambios, relevos, rotacion, planes] = await Promise.all([
            // Úlceras abiertas: sin curación reciente, o de alguien que ya no está.
            prisma.pressureUlcer.findMany({
                where: { patient: { headquartersId: hqId }, resolvedAt: null, status: { not: 'RESOLVED' } },
                select: {
                    stage: true, identifiedAt: true,
                    patient: { select: { status: true } },
                    logs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
                },
            }),
            prisma.medicationAdministration.count({
                where: {
                    status: 'ADMINISTERED', prnMotivo: { not: null }, prnEfecto: null,
                    createdAt: { gte: limitePRN },
                    patientMedication: { patient: { headquartersId: hqId } },
                },
            }),
            prisma.cambioDeCondicion.count({ where: { headquartersId: hqId, revisadoAt: null } }),
            prisma.shiftHandover.count({ where: { headquartersId: hqId, status: 'PENDING' } }),
            // Rotación vencida: quien la necesita y lleva más de 135 minutos.
            prisma.patient.findMany({
                where: {
                    headquartersId: hqId, status: 'ACTIVE',
                    OR: [
                        { requiresPosturalChanges: true },
                        { pressureUlcers: { some: { status: { not: 'RESOLVED' } } } },
                    ],
                },
                select: {
                    posturalChanges: { orderBy: { performedAt: 'desc' }, take: 1, select: { performedAt: true } },
                },
            }),
            prisma.patient.findMany({
                where: { headquartersId: hqId, status: 'ACTIVE' },
                select: { lifePlans: { select: { status: true, emailSentAt: true, nextReview: true } } },
            }),
        ]);

        const curacionesVencidas = ulceras.filter(u => {
            const fuera = u.patient.status !== 'ACTIVE' && u.patient.status !== 'TEMPORARY_LEAVE';
            if (fuera) return true;
            const ultima = u.logs[0]?.createdAt ?? u.identifiedAt;
            return ultima < limiteCuracion;
        }).length;

        const rotacionesVencidas = rotacion.filter(p => {
            const ultima = p.posturalChanges[0]?.performedAt;
            if (!ultima) return true;
            return (ahora - ultima.getTime()) / 60000 > MINUTOS_ROTACION_VENCIDA;
        }).length;

        // Mismo criterio que /api/cuidadores/lifeplans/pending-count.
        const paiPendientes = planes.filter(p => {
            const aprobado = p.lifePlans.find(l => l.status === 'APPROVED');
            if (p.lifePlans.length === 0) return true;
            if (!aprobado) return true;
            if (!aprobado.emailSentAt) return true;
            return !!(aprobado.nextReview && aprobado.nextReview < new Date());
        }).length;

        const pendientes: Pendiente[] = [
            {
                codigo: 'ROTACION_VENCIDA', titulo: 'Rotaciones vencidas',
                detalle: 'Pasaron más de 2 horas desde el último cambio de posición.',
                total: rotacionesVencidas, urgencia: 'ALTA', href: '/care/nursing',
            },
            {
                codigo: 'CURACION_VENCIDA', titulo: 'Úlceras sin curación registrada',
                detalle: `Más de ${DIAS_SIN_CURACION} días sin nota, o de alguien que ya no está en el hogar.`,
                total: curacionesVencidas, urgencia: 'ALTA', href: '/care/nursing',
            },
            {
                codigo: 'PRN_SIN_RESPUESTA', titulo: 'PRN sin saber si hizo efecto',
                detalle: 'Se administró por razón necesaria y falta decir qué pasó.',
                total: prnSinRespuesta, urgencia: 'ALTA', href: '/care',
            },
            {
                codigo: 'CAMBIOS_PISO', titulo: 'Cambios reportados del piso',
                detalle: 'Alguien vio algo distinto y espera que se revise.',
                total: cambios, urgencia: 'MEDIA', href: '/care/cambios',
            },
            {
                codigo: 'RELEVOS_PENDIENTES', titulo: 'Relevos de turno sin aceptar',
                detalle: 'El turno entrante todavía no los firmó.',
                total: relevos, urgencia: 'MEDIA', href: '/care/reports',
            },
            {
                codigo: 'PAI_PENDIENTE', titulo: 'Planes de cuido sin resolver',
                detalle: 'Falta firmarlos, hacerlos, enviarlos o revisarlos.',
                total: paiPendientes, urgencia: 'BAJA', href: '/cuidadores',
            },
        ];

        const conTrabajo = pendientes.filter(p => p.total > 0);
        const orden = { ALTA: 0, MEDIA: 1, BAJA: 2 };
        conTrabajo.sort((a, b) => orden[a.urgencia] - orden[b.urgencia] || b.total - a.total);

        return NextResponse.json({
            success: true,
            pendientes: conTrabajo,
            // Para poder decir "todo al día" con propiedad y no por falta de datos.
            revisado: pendientes.length,
            total: conTrabajo.reduce((n, p) => n + p.total, 0),
        });
    } catch (error) {
        console.error('Pendientes de enfermería:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
