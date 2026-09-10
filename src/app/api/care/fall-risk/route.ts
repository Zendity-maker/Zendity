import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { construirEvaluacion, proximaRevision, leerEvaluacion, type Respuestas } from '@/lib/downton';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * GET /api/care/fall-risk?patientId=X
 * Retorna:
 *  - patient: { id, name, downtonRisk }
 *  - fallIncidents: historial ordenado por fecha desc
 *  - riskAssessments: últimos 5 assessments
 *  - currentRiskLevel: del último assessment, o "LOW" si no hay
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const invokerHqId = auth.headquartersId;
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');

        /**
         * SIN patientId: el cuadro de la sede entera.
         *
         * Esto vivia en /corporate/medical/fall-risk, una pantalla que llevaba
         * comentada fuera del menu — existia y nadie podia llegar. Se trae a
         * enfermeria porque reevaluar el riesgo despues de una caida es un
         * acto de enfermeria, y porque el sistema YA calcula el nivel (cada
         * caida crea un FallRiskAssessment) y nadie lo estaba mirando.
         *
         * Dos diferencias con la pantalla vieja, las dos a proposito:
         *
         * 1. `status: 'ACTIVE'`. La de corporate traia a TODOS los residentes
         *    del hogar, incluidos los que fallecieron o se fueron. Es el mismo
         *    fallo que tenian las ulceras hasta que aparecio Wilfredo.
         *
         * 2. SIN EVALUAR es su propia categoria y va primero. Un residente al
         *    que nadie ha evaluado no es de riesgo bajo: es un residente del
         *    que no se sabe. Contarlo como bajo es la clase de numero que
         *    tranquiliza sin sostener nada.
         */
        if (!patientId) {
            const hace90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const residentes = await prisma.patient.findMany({
                where: { headquartersId: invokerHqId, status: 'ACTIVE' },
                select: {
                    id: true, name: true, roomNumber: true, downtonRisk: true,
                    fallRiskAssessments: {
                        orderBy: { evaluatedAt: 'desc' },
                        take: 1,
                        select: { riskLevel: true, evaluatedAt: true, factors: true, nextReviewAt: true },
                    },
                    fallIncidents: {
                        where: { incidentDate: { gte: hace90 } },
                        select: { incidentDate: true },
                        orderBy: { incidentDate: 'desc' },
                    },
                },
                orderBy: { name: 'asc' },
            });

            return NextResponse.json({
                success: true,
                residentes: residentes.map(p => {
                    const ev = p.fallRiskAssessments[0];
                    const dw = leerEvaluacion(ev?.factors);
                    return {
                        id: p.id,
                        nombre: p.name.trim(),
                        habitacion: p.roomNumber,
                        nivel: ev?.riskLevel ?? null,               // null = nadie lo ha evaluado
                        evaluadoEl: ev?.evaluatedAt ?? null,
                        proximaRevision: ev?.nextReviewAt ?? null,
                        // Vencida = pasó la fecha de revisión. Se separa de
                        // "sin evaluar": una es seguimiento, la otra es que
                        // nunca se miró.
                        vencida: !!ev?.nextReviewAt && ev.nextReviewAt.getTime() < Date.now(),
                        // Solo si la evaluación es Downton de verdad. Las
                        // viejas guardaban texto plano ("Post-caída: …") y no
                        // tienen puntaje.
                        puntaje: dw?.puntaje ?? null,
                        caidas90d: p.fallIncidents.length,
                        ultimaCaida: p.fallIncidents[0]?.incidentDate ?? null,
                    };
                }),
            });
        }

        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            select: { id: true, name: true, downtonRisk: true }
        });
        if (!patient) return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });

        const [fallIncidents, riskAssessments] = await Promise.all([
            prisma.fallIncident.findMany({
                where: { patientId },
                orderBy: { incidentDate: 'desc' },
                take: 50,
            }),
            prisma.fallRiskAssessment.findMany({
                where: { patientId },
                orderBy: { evaluatedAt: 'desc' },
                take: 5,
                include: { evaluator: { select: { name: true, role: true } } },
            }),
        ]);

        const currentRiskLevel = riskAssessments[0]?.riskLevel || 'LOW';

        return NextResponse.json({
            success: true,
            patient,
            fallIncidents,
            riskAssessments,
            currentRiskLevel,
        });
    } catch (err: any) {
        console.error('[fall-risk GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/care/fall-risk — registrar una evaluación de riesgo de caída.
 *
 * Hasta el 10-sep-2026 esto no existía. La ÚNICA forma de que un residente
 * tuviera evaluación era caerse: /api/care/incidents creaba una como efecto
 * secundario de la caída. Por eso 28 de los 32 activos no tenían ninguna, y
 * los 4 que sí eran exactamente los 4 que se habían caído. Una "prevención de
 * caídas" que solo clasifica después del hecho no previene nada.
 *
 * Quién puede: enfermería, supervisión y dirección. Decisión de Andrés y Celia
 * el 10-sep-2026 — repartir las 28 entre tres personas en tres o cuatro días.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const { patientId, respuestas, nota } = await req.json();
        if (!patientId || typeof respuestas !== 'object' || respuestas === null) {
            return NextResponse.json({ success: false, error: 'Falta el residente o las respuestas' }, { status: 400 });
        }

        // Y de SU sede, y ACTIVO. Evaluar a quien ya no está es trabajo perdido
        // y ensucia el conteo de pendientes.
        const paciente = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: auth.headquartersId, status: 'ACTIVE' },
            select: { id: true, name: true },
        });
        if (!paciente) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado o inactivo en tu sede' }, { status: 404 });
        }

        const evaluacion = construirEvaluacion(respuestas as Respuestas, typeof nota === 'string' ? nota : undefined);

        const guardada = await prisma.fallRiskAssessment.create({
            data: {
                patientId,
                evaluatorId: auth.id,
                riskLevel: evaluacion.nivel as any,
                // morseScore se queda NULL a proposito: esto es Downton. Ver
                // src/lib/downton.ts — el puntaje va dentro de factors.
                factors: JSON.stringify(evaluacion),
                nextReviewAt: proximaRevision(),
            },
        });

        /**
         * downtonRisk deja de significar "ya se cayó".
         *
         * Ese booleano se ponía en true tras cualquier caída, y la pantalla de
         * inicio lo enseña como "Alto riesgo caída". Decía una cosa queriendo
         * decir otra. Desde ahora lo dice la evaluación, que es de lo que
         * siempre debió salir.
         */
        await prisma.patient.update({
            where: { id: patientId },
            data: { downtonRisk: evaluacion.nivel === 'HIGH' },
        });

        return NextResponse.json({
            success: true,
            id: guardada.id,
            puntaje: evaluacion.puntaje,
            nivel: evaluacion.nivel,
            proximaRevision: guardada.nextReviewAt,
        });
    } catch (err: any) {
        console.error('[fall-risk POST]', err);
        return NextResponse.json({ success: false, error: 'No se pudo guardar la evaluación' }, { status: 500 });
    }
}
