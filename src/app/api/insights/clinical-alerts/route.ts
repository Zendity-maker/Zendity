import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

/**
 * GET /api/insights/clinical-alerts
 * Alertas clínicas activas en la sede del usuario.
 * Retorna 4 categorías: caídas 24h, UPP activas, meds omitidas hoy, vitales críticos hoy.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        const twentyFourHrsAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const todayStart = todayStartAST();

        const [falls, upps, omittedMeds, criticalVitalsRaw] = await Promise.all([
            // 1. Caídas últimas 24h
            prisma.fallIncident.findMany({
                where: {
                    patient: { headquartersId: hqId },
                    incidentDate: { gte: twentyFourHrsAgo },
                },
                include: { patient: { select: { id: true, name: true, roomNumber: true } } },
                orderBy: { incidentDate: 'desc' },
                take: 20,
            }),
            // 2. UPPs activas
            prisma.pressureUlcer.findMany({
                where: {
                    status: 'ACTIVE',
                    patient: { headquartersId: hqId },
                },
                include: { patient: { select: { id: true, name: true, roomNumber: true } } },
                orderBy: { identifiedAt: 'desc' },
                take: 20,
            }),
            // 3. Medicamentos omitidos hoy
            prisma.medicationAdministration.count({
                where: {
                    status: 'OMITTED',
                    createdAt: { gte: todayStart },
                    patientMedication: { patient: { headquartersId: hqId } },
                },
            }),
            // 4. Vitales críticos hoy (evaluamos criterios en memoria: temp>100.4°F o spo2<94)
            prisma.vitalSigns.findMany({
                where: {
                    patient: { headquartersId: hqId },
                    createdAt: { gte: todayStart },
                },
                select: {
                    id: true,
                    temperature: true,
                    spo2: true,
                    systolic: true,
                    diastolic: true,
                    patient: { select: { id: true, name: true, roomNumber: true } },
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        // Filtrar vitales críticos — detección unidad temperatura (Celsius si < 45 → convertir a °F)
        const criticalVitals = criticalVitalsRaw.filter(v => {
            const tempF = v.temperature < 45 ? (v.temperature * 9 / 5) + 32 : v.temperature;
            const isFeverish = tempF > 100.4;
            const isHypoxic = v.spo2 !== null && v.spo2 !== undefined && v.spo2 < 94;
            const isHypertensive = v.systolic > 140 || v.diastolic > 90;
            const isHypotensive = v.systolic < 90;
            return isFeverish || isHypoxic || isHypertensive || isHypotensive;
        });

        return NextResponse.json({
            success: true,
            falls: {
                count: falls.length,
                items: falls.map(f => ({
                    id: f.id,
                    patientId: f.patient?.id,
                    patientName: f.patient?.name,
                    room: f.patient?.roomNumber,
                    severity: f.severity,
                    location: f.location,
                    incidentDate: f.incidentDate,
                })),
            },
            upps: {
                count: upps.length,
                items: upps.map(u => ({
                    id: u.id,
                    patientId: u.patient?.id,
                    patientName: u.patient?.name,
                    room: u.patient?.roomNumber,
                    stage: u.stage,
                    location: u.bodyLocation,
                })),
            },
            omittedMeds: {
                count: omittedMeds,
            },
            criticalVitals: {
                count: criticalVitals.length,
                items: criticalVitals.slice(0, 10).map(v => ({
                    id: v.id,
                    patientId: v.patient?.id,
                    patientName: v.patient?.name,
                    room: v.patient?.roomNumber,
                    temperature: v.temperature,
                    spo2: v.spo2,
                    systolic: v.systolic,
                    diastolic: v.diastolic,
                    createdAt: v.createdAt,
                })),
            },
        });
    } catch (err: any) {
        console.error('[clinical-alerts]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
