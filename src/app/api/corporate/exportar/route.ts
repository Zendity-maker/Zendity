import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * EXPORTAR LA INFORMACIÓN DE UNA SEDE
 * ───────────────────────────────────
 * El BAA que Zéndity firma con cada hogar promete, en la cláusula de
 * terminación: "devolverá al Hogar toda la PHI en un formato utilizable y
 * legible —incluyendo expedientes clínicos, registros de medicamentos y planes
 * de atención—", y garantiza sesenta días de acceso a esa exportación incluso
 * por impago.
 *
 * Hasta hoy no existía forma de hacerlo. Ni para un hogar que se va, ni para uno
 * activo que simplemente quiera su información. Un acuerdo firmado que promete
 * algo que el sistema no puede hacer es peor que no prometerlo.
 *
 * La información es DEL HOGAR, no de Zéndity. Por eso el director de la sede
 * puede exportarla cuando quiera, sin pedirle permiso a nadie.
 *
 * La sede sale SIEMPRE de la sesión: nadie exporta la información de otra.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
            return NextResponse.json(
                { success: false, error: 'Solo el director o el administrador de la sede pueden exportar' },
                { status: 403 },
            );
        }
        const hqId = (session.user as any).headquartersId as string | undefined;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Tu usuario no tiene sede asignada' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, billingAddress: true, phone: true, capacity: true },
        });
        if (!hq) return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });

        // Expediente por residente. Se incluyen los dados de baja y fallecidos:
        // su información tiene obligaciones de retención que no desaparecen
        // porque la persona ya no esté.
        const residentes = await prisma.patient.findMany({
            where: { headquartersId: hqId },
            select: {
                id: true, name: true, dateOfBirth: true, roomNumber: true, status: true,
                admissionDate: true, leaveDate: true, dischargeDate: true,
                diet: true, careModality: true, needsDialysis: true,
                requiresPosturalChanges: true, nortonRisk: true,
                intakeData: true,
                familyMembers: {
                    select: { name: true, email: true, phone: true, relationship: true, isPrimary: true },
                },
                lifePlans: {
                    select: {
                        type: true, status: true, createdAt: true, approvedAt: true,
                        clinicalSummary: true, cognitiveLevel: true, mobility: true,
                        continence: true, dietDetails: true, risks: true, goals: true,
                        preferences: true, familyEducation: true, monitoringMethod: true,
                        revisionCriteria: true, startDate: true, nextReview: true,
                    },
                },
                medications: {
                    select: {
                        status: true, frequency: true, scheduleTimes: true,
                        instructions: true, prescribedBy: true,
                        medication: { select: { name: true, dosage: true } },
                    },
                },
                fallIncidents: {
                    select: { incidentDate: true, location: true, severity: true, interventions: true, notes: true },
                },
                pressureUlcers: {
                    select: { bodyLocation: true, stage: true, status: true, identifiedAt: true, resolvedAt: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        const generado = new Date();
        return new NextResponse(
            JSON.stringify({
                _aviso: 'Información clínica confidencial. Contiene datos de salud protegidos (PHI). '
                    + 'Manéjese conforme a HIPAA y al acuerdo entre el hogar y Zéndity.',
                sede: hq.name,
                direccion: hq.billingAddress,
                telefono: hq.phone,
                capacidad: hq.capacity,
                generadoEl: generado.toISOString(),
                totalResidentes: residentes.length,
                residentes,
            }, null, 2),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': `attachment; filename="zendity_${hq.name.replace(/[^a-zA-Z0-9]/g, '_')}_${generado.toISOString().slice(0, 10)}.json"`,
                    'Cache-Control': 'no-store',
                },
            },
        );
    } catch (e: any) {
        console.error('[exportar]', e);
        return NextResponse.json({ success: false, error: 'No se pudo generar la exportación' }, { status: 500 });
    }
}
