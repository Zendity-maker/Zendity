import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

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
                        select: { riskLevel: true, evaluatedAt: true, factors: true },
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
                residentes: residentes.map(p => ({
                    id: p.id,
                    nombre: p.name.trim(),
                    habitacion: p.roomNumber,
                    nivel: p.fallRiskAssessments[0]?.riskLevel ?? null,   // null = sin evaluar
                    evaluadoEl: p.fallRiskAssessments[0]?.evaluatedAt ?? null,
                    caidas90d: p.fallIncidents.length,
                    ultimaCaida: p.fallIncidents[0]?.incidentDate ?? null,
                })),
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
