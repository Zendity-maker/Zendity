import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';

export async function POST(req: Request) {
    try {
        const { patientMedicationId, administeredById, status, notes } = await req.json();

        // Validaciones básicas preventivas
        if (!patientMedicationId || !administeredById) {
            return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
        }

        const adminStatus = status || 'ADMINISTERED';

        const admin = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById,
                status: adminStatus,
                notes
            }
        });

        // FASE 45: Gamification & Trust Score Penalty
        if (adminStatus === 'OMITTED') {
            await prisma.user.update({
                where: { id: administeredById },
                data: {
                    complianceScore: {
                        decrement: 5
                    }
                }
            });
        }

        // Notificación EMAR_ALERT cuando el medicamento no se administra
        if (adminStatus === 'OMITTED' || adminStatus === 'MISSED') {
            try {
                const patientMed = await prisma.patientMedication.findUnique({
                    where: { id: patientMedicationId },
                    include: {
                        patient: { select: { name: true, headquartersId: true } },
                        medication: { select: { name: true } }
                    }
                });
                if (patientMed?.patient) {
                    const schedule = patientMed.scheduleTimes || 'sin horario';
                    const medName = patientMed.medication?.name || 'medicamento';
                    const statusLabel = adminStatus === 'OMITTED' ? 'omitido' : 'no administrado';
                    await notifyRoles(patientMed.patient.headquartersId, ['SUPERVISOR', 'NURSE'], {
                        type: 'EMAR_ALERT',
                        title: 'Medicamento no administrado',
                        message: `${patientMed.patient.name} — ${medName} (${schedule}) ${statusLabel}`,
                    });
                }
            } catch (e) { console.error('[notify EMAR_ALERT]', e); }
        }

        return NextResponse.json({ success: true, administration: admin });

    } catch (error) {
        console.error("Meds POST Error:", error);
        return NextResponse.json({ success: false, error: "Error registrando medicamento" }, { status: 500 });
    }
}
