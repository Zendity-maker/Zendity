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
import { DIAS_SIN_CURACION, DIAS_SIN_VALORACION, ULCERA_ABIERTA } from '@/lib/upp';
import { HORAS_PARA_REVISAR_CAMBIO, pasoElCompromiso, horasEsperando, detectarPatrones, etiquetaArea } from '@/lib/cambios-de-condicion';

export const dynamic = 'force-dynamic';

/** Igual que ULCERA_SIN_SEGUIMIENTO en src/lib/verificaciones.ts. */
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
        const limiteValoracion = new Date(ahora - DIAS_SIN_VALORACION * 86400000);
        const limitePRN = new Date(ahora - HORAS_PARA_EXIGIR_EFECTO * 3600000);

        const [ulceras, prnSinRespuesta, cambios, relevos, rotacion, planes, riesgoCaida] = await Promise.all([
            // Úlceras abiertas: sin curación reciente, o de alguien que ya no está.
            prisma.pressureUlcer.findMany({
                where: { patient: { headquartersId: hqId }, ...ULCERA_ABIERTA },
                select: {
                    stage: true, identifiedAt: true,
                    patient: { select: { status: true } },
                    // Con el tipo: un cambio de aposito NO cuenta como curacion.
                    // Ver src/lib/upp.ts. Antes bastaba el ultimo log de
                    // cualquier clase y eso habria callado la alerta en cuanto
                    // una cuidadora cambiara una gasa.
                    logs: { orderBy: { createdAt: 'desc' }, take: 12, select: { createdAt: true, tipo: true } },
                },
            }),
            prisma.medicationAdministration.count({
                where: {
                    status: 'ADMINISTERED', prnMotivo: { not: null }, prnEfecto: null,
                    createdAt: { gte: limitePRN },
                    patientMedication: { patient: { headquartersId: hqId } },
                },
            }),
            // findMany y no count: hace falta la EDAD del mas viejo, no cuantos
            // hay. "6 pendientes" y "uno lleva cinco dias" no son el mismo aviso.
            prisma.cambioDeCondicion.findMany({
                where: { headquartersId: hqId, revisadoAt: null },
                select: {
                    reportadoAt: true, area: true, patientId: true,
                    patient: { select: { name: true, roomNumber: true, colorGroup: true } },
                },
                orderBy: { reportadoAt: 'asc' },
            }),
            prisma.shiftHandover.count({ where: { headquartersId: hqId, status: 'PENDING' } }),
            // Rotación vencida: quien la necesita y lleva más de 135 minutos.
            prisma.patient.findMany({
                where: {
                    headquartersId: hqId, status: 'ACTIVE',
                    OR: [
                        { requiresPosturalChanges: true },
                        { pressureUlcers: { some: ULCERA_ABIERTA } },
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
            /**
             * Riesgo de caida: sin evaluar nunca, o con la evaluacion vencida.
             *
             * Hasta el 10-sep-2026 la unica forma de tener evaluacion era
             * caerse —se creaba sola como efecto secundario de la caida— y por
             * eso 28 de 32 activos no tenian ninguna. Ahora hay formulario, y
             * este es el aviso que lo pide: al ingreso y cada 6 meses.
             */
            prisma.patient.findMany({
                where: { headquartersId: hqId, status: 'ACTIVE' },
                select: {
                    fallRiskAssessments: {
                        orderBy: { evaluatedAt: 'desc' }, take: 1,
                        select: { nextReviewAt: true },
                    },
                },
            }),
        ]);

        /**
         * DOS HUECOS DISTINTOS, DOS LINEAS DISTINTAS.
         *
         *   sin curar   nadie aplico el tratamiento del plan del home care
         *   sin mirar   nadie con criterio clinico la ha valorado
         *
         * Se cuentan aparte porque se resuelven distinto: lo primero espera a
         * la enfermera de servicios externos; lo segundo lo puede hacer Celia
         * hoy mismo. Meterlos en un solo numero es dar un total sobre el que
         * nadie sabe que hacer.
         */
        const fueraDelHogar = (st: string) => st !== 'ACTIVE' && st !== 'TEMPORARY_LEAVE';
        const ultimo = (u: typeof ulceras[number], tipos: string[]) =>
            u.logs.find(l => tipos.includes(l.tipo))?.createdAt ?? u.identifiedAt;

        const curacionesVencidas = ulceras.filter(u =>
            fueraDelHogar(u.patient.status) || ultimo(u, ['CURACION']) < limiteCuracion,
        ).length;

        const sinValorar = ulceras.filter(u =>
            !fueraDelHogar(u.patient.status) && ultimo(u, ['CURACION', 'VALORACION']) < limiteValoracion,
        ).length;

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

        const ahoraMs = Date.now();
        const vencidos = cambios.filter(c => pasoElCompromiso(c.reportadoAt)).length;
        // Un patron no espera las 48 horas. Ver detectarPatrones.
        const patrones = detectarPatrones(cambios as any);
        const horasDelMasViejo = cambios.length > 0 ? horasEsperando(cambios[0].reportadoAt) : 0;
        const sinEvaluarCaida = riesgoCaida.filter(p => p.fallRiskAssessments.length === 0).length;
        const caidaVencida = riesgoCaida.filter(p => {
            const rev = p.fallRiskAssessments[0]?.nextReviewAt;
            return !!rev && rev.getTime() < ahoraMs;
        }).length;

        const pendientes: Pendiente[] = [
            {
                codigo: 'ROTACION_VENCIDA', titulo: 'Rotaciones vencidas',
                detalle: 'Pasaron más de 2 horas desde el último cambio de posición.',
                total: rotacionesVencidas, urgencia: 'ALTA', href: '/care/nursing',
            },
            {
                codigo: 'CURACION_VENCIDA', titulo: 'Úlceras sin curación registrada',
                detalle: `Más de ${DIAS_SIN_CURACION} días sin el tratamiento del plan, o de alguien que ya no está en el hogar. Un cambio de apósito no cuenta.`,
                total: curacionesVencidas, urgencia: 'ALTA', href: '/care/nursing',
            },
            {
                codigo: 'UPP_SIN_VALORAR', titulo: 'Úlceras que nadie ha mirado',
                detalle: `Más de ${DIAS_SIN_VALORACION} días sin que enfermería o dirección la valoren.`,
                total: sinValorar, urgencia: 'ALTA', href: '/care/nursing',
            },
            {
                codigo: 'PRN_SIN_RESPUESTA', titulo: 'PRN sin saber si hizo efecto',
                detalle: 'Se administró por razón necesaria y falta decir qué pasó.',
                total: prnSinRespuesta, urgencia: 'ALTA', href: '/care',
            },
            /**
             * EL PATRON VA PRIMERO Y NO ESPERA EL PLAZO.
             *
             * Once residentes con lo mismo el mismo dia no es una cola que se
             * atiende en 48 horas: es algo que esta pasando ahora. La linea dice
             * lo que comparten —grupo, planta— porque ahi es por donde se
             * empieza a buscar, no en los once expedientes.
             */
            ...patrones.map(p => ({
                codigo: `PATRON_${p.area}`,
                titulo: `${p.residentes.length} residentes con lo mismo en ${etiquetaArea(p.area).toLowerCase()}`,
                detalle: p.enComun
                    ? `${p.enComun}. Eso no son ${p.residentes.length} casos sueltos.`
                    : `En menos de ${HORAS_PARA_REVISAR_CAMBIO} horas. Míralo junto, no uno por uno.`,
                total: p.residentes.length,
                urgencia: 'ALTA' as const,
                href: '/care/cambios',
            })),
            {
                codigo: 'CAMBIOS_PISO',
                titulo: vencidos > 0
                    ? 'Cambios del piso que pasaron el plazo'
                    : 'Cambios reportados del piso',
                detalle: vencidos > 0
                    ? `${vencidos} llevan más de ${HORAS_PARA_REVISAR_CAMBIO} horas esperando. El más viejo, ${Math.floor(horasDelMasViejo / 24)} día${Math.floor(horasDelMasViejo / 24) === 1 ? '' : 's'}.`
                    : 'Alguien vio algo distinto y espera que se revise.',
                total: cambios.length,
                // ALTA en cuanto uno pase de 48 horas. Un aviso temprano que
                // lleva cinco dias esperando ya no es temprano, y quedaba
                // debajo de las ulceras para siempre por ser MEDIA fija.
                urgencia: vencidos > 0 ? 'ALTA' : 'MEDIA',
                href: '/care/cambios',
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
            {
                codigo: 'RIESGO_CAIDA_PENDIENTE',
                titulo: sinEvaluarCaida > 0 && caidaVencida === 0
                    ? 'Residentes sin evaluar el riesgo de caída'
                    : 'Riesgo de caída sin evaluar o vencido',
                detalle: sinEvaluarCaida > 0
                    ? `${sinEvaluarCaida} nunca se han evaluado. Se hace al ingreso y se repite cada 6 meses.`
                    : 'Pasaron los 6 meses desde la última evaluación.',
                total: sinEvaluarCaida + caidaVencida,
                // ALTA mientras haya gente sin evaluar NUNCA: eso no es
                // seguimiento atrasado, es que nadie los ha mirado.
                urgencia: sinEvaluarCaida > 0 ? 'ALTA' : 'MEDIA',
                href: '/care/caidas',
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
