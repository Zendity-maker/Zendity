import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqIdOrAll } from '@/lib/hq-resolver';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/onboarding-status?hqId=xxx
 *
 * Devuelve el estado de los 5 pasos de arranque para una sede nueva.
 * Se usa en el OnboardingChecklist del dashboard corporativo.
 *
 * Pasos:
 *  1. Configurar sede (logo, teléfono o dirección de facturación)
 *  2. Agregar primer empleado (rol ≠ DIRECTOR/SUPER_ADMIN)
 *  3. Registrar primer residente (patient activo)
 *  4. Asignar medicamentos (PatientMedication activo en esta sede)
 *  5. Publicar horario (Schedule con status PUBLISHED)
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // hqId de la sesión (resolver con ALL): rol limitado → su sede (ignora ?hqId);
    // DIRECTOR/ADMIN → 'ALL' o sede validada. Antes: ?hqId del cliente sin validar.
    const { searchParams } = new URL(req.url);
    const hqId = await resolveEffectiveHqIdOrAll(session, searchParams.get('hqId'));

    // Vista consolidada "ALL" → no aplica checklist de onboarding
    if (!hqId || hqId === 'ALL') {
        return NextResponse.json({ success: true, completed: true, steps: [], completedCount: 5 });
    }

    try {
        const [hq, staffCount, patientCount, medicationCount, scheduleCount] = await Promise.all([
            prisma.headquarters.findUnique({
                where: { id: hqId },
                select: { logoUrl: true, ownerPhone: true, billingAddress: true, taxId: true },
            }),
            prisma.user.count({
                where: {
                    headquartersId: hqId,
                    isActive: true,
                    isDeleted: false,
                    // Excluir DIRECTOR y SUPER_ADMIN — ellos son los que usan este checklist
                    role: { notIn: ['DIRECTOR', 'SUPER_ADMIN'] as any },
                },
            }),
            prisma.patient.count({
                where: { headquartersId: hqId, status: 'ACTIVE' },
            }),
            prisma.patientMedication.count({
                where: {
                    patient: { headquartersId: hqId },
                    isActive: true,
                    status: 'ACTIVE',
                },
            }),
            prisma.schedule.count({
                where: { headquartersId: hqId, status: 'PUBLISHED' },
            }),
        ]);

        const steps = [
            {
                id: 'hq_setup',
                label: 'Configura tu sede',
                description: 'Sube el logo y completa los datos de tu centro',
                done: !!(hq?.logoUrl || hq?.ownerPhone || hq?.billingAddress || hq?.taxId),
                href: '/corporate/hq',
            },
            {
                id: 'staff',
                label: 'Agrega tu primer empleado',
                description: 'Registra cuidadores, enfermeras y supervisores',
                done: staffCount > 0,
                href: '/corporate/hr/staff',
            },
            {
                id: 'residents',
                label: 'Registra tu primer residente',
                description: 'Crea el perfil clínico del primer residente',
                done: patientCount > 0,
                href: '/corporate/patients/intake',
            },
            {
                id: 'medications',
                label: 'Asigna medicamentos',
                description: 'Configura el eMAR digital con los fármacos activos',
                done: medicationCount > 0,
                href: '/med',
            },
            {
                id: 'schedule',
                label: 'Publica el primer horario',
                description: 'Crea y publica el horario semanal de turnos',
                done: scheduleCount > 0,
                href: '/hr/schedule',
            },
        ];

        const completedCount = steps.filter((s) => s.done).length;

        return NextResponse.json({
            success: true,
            completed: completedCount === steps.length,
            steps,
            completedCount,
        });
    } catch (e: any) {
        console.error('[onboarding-status]', e);
        return NextResponse.json({ success: false, error: 'Error cargando estado' }, { status: 500 });
    }
}
