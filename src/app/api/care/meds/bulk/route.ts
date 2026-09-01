import { prisma } from '@/lib/prisma';
import { resolverHoraReal } from '@/lib/hora-real';
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

        const { action, medicationIds, scheduleTime, notes, signatureBase64, reason, administeredAt: horaDeclarada } = await req.json();

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

        /**
         * Se salta lo que YA está resuelto hoy, en vez de abortar el pack entero.
         *
         * ESTO ERA EL AGUJERO DEL eMAR. La comprobación anterior buscaba si
         * CUALQUIERA de los medicamentos enviados tenía registro hoy y, si lo
         * encontraba, devolvía 409 para todos. Y el cliente manda el pack
         * COMPLETO, incluido lo que se acaba de omitir. La secuencia real era:
         *
         *   1. La cuidadora omite un medicamento — "el residente lo rechazó".
         *   2. Firma para administrar el resto del pack.
         *   3. El pack lleva el omitido → la comprobación lo encuentra → 409.
         *   4. TODO el pack falla. Los demás medicamentos no se registran.
         *
         * Omitir uno rompía el pack entero, con un mensaje —"ya fue procesado
         * hoy"— que además era falso. La respuesta racional de quien está en el
         * piso es no omitir nunca, y eso es exactamente lo que dicen los datos:
         * 22 668 administrados contra 2 omitidos en tres meses. No es un hogar
         * con 99.99 % de cumplimiento; es que registrar la verdad rompía el
         * turno.
         *
         * Peor que el número: cuando el pack fallaba, administraciones REALES
         * se quedaban sin registrar. El expediente perdía dosis que sí se dieron.
         *
         * Ahora se filtra y se procesa el resto. La protección contra doble
         * administración se conserva —lo ya resuelto no se vuelve a escribir—
         * pero deja de castigar a quien registra lo que de verdad pasó.
         */
        let idsAProcesar: string[] = medicationIds;
        let yaResueltos = 0;
        if ((isPack || isOmit) && scheduleTime) {
            const resueltos = await prisma.medicationAdministration.findMany({
                where: {
                    patientMedicationId: { in: medicationIds },
                    scheduleTime,
                    createdAt: { gte: todayStartAST() },
                    status: { in: ['ADMINISTERED', 'OMITTED', 'REFUSED'] }
                },
                select: { patientMedicationId: true }
            });
            const yaHechos = new Set(resueltos.map(r => r.patientMedicationId));
            yaResueltos = yaHechos.size;
            idsAProcesar = medicationIds.filter((id: string) => !yaHechos.has(id));

            // Solo si NO queda nada por hacer es un duplicado de verdad — la
            // doble pulsación del botón, que es lo que esta guarda protegía.
            if (idsAProcesar.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'Este pack ya fue procesado hoy' },
                    { status: 409 },
                );
            }
        }

        // Mapear status — REFUSED viene del wizard de warnings del cierre de
        // turno, no de este endpoint bulk. Actions válidas: ADMINISTER_PACK |
        // OMIT | OMISSION | PRN.
        let adminStatus: MedStatus = 'ADMINISTERED';
        if (isOmit) adminStatus = 'OMITTED';

        const now = new Date();

        // ── HORA REAL vs HORA DE TECLEO ──
        // Hasta hoy `administeredAt` se sellaba con `now` para todo el pack, o
        // sea que era identico a `createdAt`: el expediente guardaba la hora en
        // que se toco el boton y la llamaba hora de administracion. En 5,070
        // registros de 21 dias la diferencia era de CERO minutos en el 100%.
        // Por eso baños y medicamentos salian a la misma hora en la auditoria.
        //
        // Ahora la cuidadora declara cuando administro de verdad. `createdAt`
        // sigue siendo automatico e inalterable, asi que el expediente conserva
        // las dos horas y se puede leer "administrado 8:00, registrado 11:30".
        //
        // Limites: no se acepta futuro (mas de 5 min de reloj desfasado) ni mas
        // de 12 horas atras — una hora declarada sin limites es peor que ninguna,
        // porque vuelve el campo inauditable.
        // La cuidadora declara cuando administro de verdad; `createdAt` sigue
        // siendo automatico, asi que el expediente conserva las dos horas.
        // Ver src/lib/hora-real.ts para los limites y el porque.
        const hora = resolverHoraReal(adminStatus === 'ADMINISTERED' ? horaDeclarada : undefined, now);
        if (!hora.ok) {
            return NextResponse.json({ success: false, error: hora.error }, { status: 400 });
        }
        const administeredAt = hora.hora;

        const dataToInsert = idsAProcesar.map((medId: string) => ({
            patientMedicationId: medId,
            administeredById: invokerId,
            status: adminStatus,
            scheduleTime: scheduleTime || null,
            administeredAt: adminStatus === 'ADMINISTERED' ? administeredAt : null,
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
                const escritos = new Set(idsAProcesar);
                for (const m of validMeds) {
                    if (!escritos.has(m.id)) continue;
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
                        message: `${patientName} — ${medList} omitido${scheduleTime ? ` (${scheduleTime})` : ''}. Razón: ${reason.trim()}. Por: ${invokerName}`,
                        link: '/care/supervisor',
                    });
                }
            } catch (e) {
                console.error('[notify OMIT]', e);
            }
        }

        // yaResueltos viaja al cliente para que pueda decir la verdad: "8 de 9
        // administrados, 1 ya estaba omitido" en vez de callarse la diferencia.
        return NextResponse.json({
            success: true,
            count: result.count,
            statusApplied: adminStatus,
            yaResueltos,
        });

    } catch (error) {
        console.error("Bulk Meds Error:", error);
        return NextResponse.json({ success: false, error: "Error procesando medicamentos en bloque" }, { status: 500 });
    }
}
