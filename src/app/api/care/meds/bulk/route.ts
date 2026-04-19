import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { MedStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';

// CAREGIVER puede firmar el pack del turno. NURSE/SUP/DIR/ADMIN también.
const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// Actions:
//  - 'ADMINISTER_PACK' — firma única para un grupo de meds del mismo slot ("8:00 AM")
//  - 'OMIT'            — omisión individual (o de varios) con razón + notifica NURSE/SUP
//  - 'PRN'             — dosis S.O.S. con firma (flujo legacy preservado)
//  - 'OMISSION'        — alias legacy de 'OMIT' (preservar compat con UI antigua)
//
// Reglas:
//  - ADMINISTER_PACK requiere signatureBase64
//  - OMIT requiere reason con ≥10 chars
//  - Dup-check HOY por (medicationId, scheduleTime) antes de insertar
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerName = (session.user as any).name || 'Cuidador';
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado para administración masiva de medicamentos' }, { status: 403 });
        }

        const { action, medicationIds, scheduleTime, notes, signatureBase64, reason } = await req.json();

        if (!action || !medicationIds || !Array.isArray(medicationIds) || medicationIds.length === 0) {
            return NextResponse.json({ success: false, error: "Datos incompletos para la acción masiva" }, { status: 400 });
        }

        // Tenant check — meds deben pertenecer a residentes de la sede del invocador.
        // Traemos patient+medication para armar la notificación de omisión.
        const validMeds = await prisma.patientMedication.findMany({
            where: {
                id: { in: medicationIds },
                patient: { headquartersId: hqId }
            },
            select: {
                id: true,
                patient: { select: { id: true, name: true } },
                medication: { select: { name: true, dosage: true } }
            }
        });
        if (validMeds.length !== medicationIds.length) {
            return NextResponse.json({ success: false, error: 'Medicamentos no encontrados' }, { status: 404 });
        }

        // Normalizar action
        const isPack = action === 'ADMINISTER_PACK';
        const isOmit = action === 'OMIT' || action === 'OMISSION';
        const isPRN = action === 'PRN';

        // Validaciones por tipo
        if (isPack && !signatureBase64) {
            return NextResponse.json({ success: false, error: 'Firma requerida para administrar el pack' }, { status: 400 });
        }
        if (isOmit && (!reason || typeof reason !== 'string' || reason.trim().length < 10)) {
            return NextResponse.json({ success: false, error: 'Razón de omisión requerida (mínimo 10 caracteres)' }, { status: 400 });
        }

        // Dup-check hoy: si cualquier med del pack ya tiene registro resolvido HOY para
        // este scheduleTime, abortamos para prevenir doble administración.
        if ((isPack || isOmit) && scheduleTime) {
            const dup = await prisma.medicationAdministration.findFirst({
                where: {
                    patientMedicationId: { in: medicationIds },
                    scheduleTime,
                    createdAt: { gte: todayStartAST() },
                    status: { in: ['ADMINISTERED', 'OMITTED', 'REFUSED'] }
                },
                select: { id: true }
            });
            if (dup) {
                return NextResponse.json({ success: false, error: 'Este pack ya fue procesado hoy' }, { status: 409 });
            }
        }

        // Mapear status
        let adminStatus: MedStatus = 'ADMINISTERED';
        if (isOmit) adminStatus = 'OMITTED';
        if (action === 'REFUSED') adminStatus = 'REFUSED';

        const now = new Date();
        const dataToInsert = medicationIds.map((medId: string) => ({
            patientMedicationId: medId,
            administeredById: invokerId,
            status: adminStatus,
            scheduleTime: scheduleTime || null,
            administeredAt: adminStatus === 'ADMINISTERED' ? now : null,
            notes: isOmit
                ? `Omitido: ${reason.trim()}`
                : (notes || (isPRN ? 'Administración PRN de emergencia' : undefined)),
            signatureBase64: signatureBase64 || null
        }));

        const result = await prisma.medicationAdministration.createMany({ data: dataToInsert });

        // Notificar NURSE/SUPERVISOR en omisión (bloqueante suave — error de notificación no revierte registro)
        if (isOmit) {
            try {
                // Agrupar por residente para emitir un solo mensaje por residente
                const byPatient = new Map<string, { patientName: string; medNames: string[] }>();
                for (const m of validMeds) {
                    const pid = m.patient?.id;
                    if (!pid) continue;
                    if (!byPatient.has(pid)) byPatient.set(pid, { patientName: m.patient!.name, medNames: [] });
                    byPatient.get(pid)!.medNames.push(m.medication?.name || 'Medicamento');
                }
                for (const { patientName, medNames } of byPatient.values()) {
                    const medList = medNames.join(', ');
                    await notifyRoles(hqId, ['NURSE', 'SUPERVISOR'], {
                        type: 'EMAR_ALERT',
                        title: 'Medicamento omitido',
                        message: `${patientName} — ${medList} omitido${scheduleTime ? ` (${scheduleTime})` : ''}. Razón: ${reason.trim()}. Por: ${invokerName}`
                    });
                }
            } catch (e) {
                console.error('[notify OMIT]', e);
            }
        }

        return NextResponse.json({ success: true, count: result.count, statusApplied: adminStatus });

    } catch (error) {
        console.error("Bulk Meds Error:", error);
        return NextResponse.json({ success: false, error: "Error procesando medicamentos en bloque" }, { status: 500 });
    }
}
