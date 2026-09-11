import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { esFrecuenciaValida, diasValidos } from '@/lib/receta';

// HIPAA: solo personal clínico puede leer/escribir prescripciones.
// CRUD de PatientMedication afecta órdenes médicas — requiere auth real.
const READ_ROLES  = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];
const WRITE_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    try {
        const auth = await requireRole(READ_ROLES);
        if (auth instanceof NextResponse) return auth;
        const medications = await prisma.medication.findMany({
            orderBy: { name: 'asc' }
        });

        // FASE 9: Deduplicación Estricta por Nombre para el Catálogo Visual
        const uniqueMedsMap = new Map();
        medications.forEach(med => {
            const key = med.name.toUpperCase().trim();
            if (!uniqueMedsMap.has(key)) {
                uniqueMedsMap.set(key, med);
            }
        });

        const uniqueMeds = Array.from(uniqueMedsMap.values());

        return NextResponse.json({ success: true, medications: uniqueMeds });
    } catch (error) {
        console.error("Fetch Meds Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch medications" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        // Auth + rol clínico con permisos de escritura (NURSE+).
        const auth = await requireRole(WRITE_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, headquartersId: invokerHqId } = auth;

        const {
            action, patientId, medicationId, scheduleTimes, prepDuration, reason, patientMedicationId,
            // Los tres que faltaban. Ver src/lib/receta.ts.
            frequency, scheduleDays, prescribedBy,
        } = await req.json();

        /**
         * FRECUENCIA, DIAS Y PRESCRIPTOR.
         *
         * `frequency` existe en el modelo desde siempre y NO lo pedia ningun
         * formulario, asi que "semanal" se escribia dentro del horario:
         * "08:00 AM (Semanal)". El agrupador de packs parsea ese texto con un
         * regex estricto y descarta lo que no encaja en silencio. Medido el
         * 05-sep-2026: 13 medicamentos activos de Cupey que no aparecen en
         * ningun pack, entre ellos Warfarin 1mg con 107 dias sin una sola
         * administracion.
         *
         * `prescribedBy` es igual de viejo: se LEE en la pestaña del eMAR —hay
         * un bloque rotulado "Prescrito por"— y no se escribia en ningun sitio.
         * 261 de 261 medicamentos activos con el campo vacio. El nombre del
         * medico terminaba, cuando terminaba, en el texto de la justificacion.
         *
         * Se validan aqui y no se confia en lo que llegue: una frecuencia
         * inventada vuelve a DIARIO, que es el comportamiento de siempre.
         */
        const frecuencia = esFrecuenciaValida(frequency) ? frequency : 'DIARIO';
        const dias = frecuencia === 'SEMANAL' ? diasValidos(scheduleDays) : [];
        const medico = typeof prescribedBy === 'string' ? prescribedBy.trim().slice(0, 120) || null : null;

        /**
         * EN UNA MODIFICACION, LO QUE NO SE MANDA NO SE TOCA.
         *
         * Celia, 11-sep-2026: "los horarios Semanal no le permite colocarlo un
         * solo dia, como el caso del alendronato de Natalia".
         *
         * Esto era literal, y el culpable estaba aqui. El modal "Modificar
         * Horario" de /med no manda `frequency` ni `scheduleDays`, y esta rama
         * escribia `frequency: frecuencia` —que sin campo cae a DIARIO— y
         * `scheduleDays: []`. Resultado: abrir una receta SEMANAL para cambiarle
         * la hora la convertia en DIARIA y le borraba los dias, sin decir nada.
         * Se pone el viernes, se edita cualquier cosa, y el viernes desaparece.
         *
         * Una receta nueva (ADDED) si necesita frecuencia si o si, y ahi DIARIO
         * como defecto es correcto. Una modificacion no: un campo ausente
         * significa "no lo cambies", que es lo que `undefined` ya significa en
         * Prisma. Afecta a las 7 recetas semanales vivas de Cupey.
         */
        const cambiosDeFrecuencia = esFrecuenciaValida(frequency)
            ? { frequency: frecuencia, scheduleDays: dias }
            : {};

        // authorId SIEMPRE viene de la sesión, no del body (auditoría HIPAA).
        const authorId = invokerId;

        if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
            return NextResponse.json({ success: false, error: "Justificación obligatoria (mínimo 5 caracteres) — registro HIPAA." }, { status: 400 });
        }

        let updatedMed;

        if (action === 'ADDED') {
            if (!patientId || !medicationId || !scheduleTimes) {
                return NextResponse.json({ success: false, error: "Faltan campos: patientId, medicationId, scheduleTimes." }, { status: 400 });
            }
            // Tenant check: el paciente debe estar en la sede del invocador.
            const patient = await prisma.patient.findFirst({
                where: { id: patientId, headquartersId: invokerHqId },
                select: { id: true },
            });
            if (!patient) {
                return NextResponse.json({ success: false, error: "Residente no encontrado en tu sede." }, { status: 404 });
            }
            // "Ciertos dias" sin ningun dia marcado seria un medicamento que no
            // toca nunca — peor que el problema que se viene a resolver.
            if (frecuencia === 'SEMANAL' && dias.length === 0) {
                return NextResponse.json({ success: false, error: "Marca al menos un día de la semana." }, { status: 400 });
            }
            updatedMed = await prisma.patientMedication.create({
                data: {
                    patientId, medicationId, scheduleTimes,
                    prepDuration: prepDuration || "1_SEMANA",
                    frequency: frecuencia,
                    scheduleDays: dias,
                    prescribedBy: medico,
                    status: frecuencia === 'PRN' ? 'PRN' : 'ACTIVE',
                }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'ADDED', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        /**
         * AUTORIZAR UN BORRADOR DEL INGRESO.
         *
         * La admision deja la receta en DRAFT / isActive:false a proposito: es
         * una barrera clinica, alguien tiene que mirarla antes de que llegue a
         * la tableta. El problema no era la barrera, era donde estaba: la unica
         * pantalla que autorizaba —/corporate/care/triage/emar— no esta en el
         * menu de nadie y firmaba con un usuario inventado ("SUPERVISOR-MD-01").
         * Asi que los borradores no se autorizaban: se volvian a teclear a mano
         * en Zendity Med, que es la mitad del "hay que repetir cosas en
         * diferentes lugares" que describe Celia. Y el que no se reteclea se
         * queda: el Baclofen 10mg de Carlos Varona lleva ahi desde su ingreso.
         *
         * Ahora se autoriza desde la misma pantalla donde se trabaja, con el
         * usuario de verdad de la sesion y su razon escrita.
         */
        else if (action === 'AUTHORIZED') {
            if (!patientMedicationId) {
                return NextResponse.json({ success: false, error: "patientMedicationId requerido." }, { status: 400 });
            }
            const borrador = await prisma.patientMedication.findFirst({
                where: { id: patientMedicationId, status: 'DRAFT', patient: { headquartersId: invokerHqId } },
                select: { id: true },
            });
            if (!borrador) {
                return NextResponse.json({ success: false, error: "Borrador no encontrado en tu sede — puede que ya esté autorizado." }, { status: 404 });
            }
            // La misma guarda que en ADDED: una pauta semanal sin dia no toca nunca.
            if (frecuencia === 'SEMANAL' && dias.length === 0) {
                return NextResponse.json({ success: false, error: "Marca al menos un día de la semana." }, { status: 400 });
            }
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: {
                    ...(typeof scheduleTimes === 'string' && scheduleTimes.trim()
                        ? { scheduleTimes } : {}),
                    ...(prepDuration ? { prepDuration } : {}),
                    // Aqui SI se escribe siempre la frecuencia: una receta que
                    // empieza a vivir no puede quedar a medias.
                    frequency: frecuencia,
                    scheduleDays: dias,
                    ...(medico !== null ? { prescribedBy: medico } : {}),
                    isActive: true,
                    status: 'ACTIVE',
                }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'VERIFIED_BY_NURSE', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        else if (action === 'MODIFIED') {
            if (!patientMedicationId) {
                return NextResponse.json({ success: false, error: "patientMedicationId requerido." }, { status: 400 });
            }
            // Tenant check via patient → headquartersId.
            const existing = await prisma.patientMedication.findFirst({
                where: { id: patientMedicationId, patient: { headquartersId: invokerHqId } },
                select: { id: true },
            });
            if (!existing) {
                return NextResponse.json({ success: false, error: "Prescripción no encontrada en tu sede." }, { status: 404 });
            }
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: {
                    // Lo mismo que arriba: un campo que no llega, no se pisa.
                    ...(typeof scheduleTimes === 'string' && scheduleTimes.trim()
                        ? { scheduleTimes } : {}),
                    ...(prepDuration ? { prepDuration } : {}),
                    ...cambiosDeFrecuencia,
                    ...(medico !== null ? { prescribedBy: medico } : {}),
                    // NO se fuerza isActive/status aqui. Ahora que DISCONTINUED
                    // es un estado de verdad, "modificar" no puede resucitar una
                    // receta descontinuada sin que nada lo diga: revivirla tiene
                    // que ser un acto propio, no el efecto de cambiar una hora.
                }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'MODIFIED', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        else if (action === 'DISCONTINUED') {
            if (!patientMedicationId) {
                return NextResponse.json({ success: false, error: "patientMedicationId requerido." }, { status: 400 });
            }
            const existing = await prisma.patientMedication.findFirst({
                where: { id: patientMedicationId, patient: { headquartersId: invokerHqId } },
                select: { id: true },
            });
            if (!existing) {
                return NextResponse.json({ success: false, error: "Prescripción no encontrada en tu sede." }, { status: 404 });
            }
            /**
             * DESCONTINUAR ES UN ESTADO, NO UNA PALABRA EN EL CAMPO DE LA HORA.
             *
             * Esto escribia la cadena "DESCONTINUADO" DENTRO de `scheduleTimes`
             * —el campo de los horarios— y dejaba `status` en ACTIVE. O sea que
             * una receta descontinuada quedaba diciendo tres cosas a la vez:
             *   status       = ACTIVE        (mentira)
             *   isActive     = false         (verdad)
             *   scheduleTimes= DESCONTINUADO (un estado metido en una hora)
             *
             * Hay 27 asi en produccion. Y de paso se perdian los horarios
             * reales: al descontinuar se pisaba el unico sitio donde constaba a
             * que hora se daba, que es justo lo que hace falta si mañana hay que
             * reconstruir lo que el residente recibia.
             *
             * `DISCONTINUED` ya existia en el enum MedActiveStatus desde
             * siempre. Solo habia que usarlo.
             */
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: { isActive: false, status: 'DISCONTINUED' }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'DISCONTINUED', patientMedicationId: patientMedicationId, authorId, reason }
            });
        } else {
            return NextResponse.json({ success: false, error: "Acción inválida (use ADDED, AUTHORIZED, MODIFIED o DISCONTINUED)." }, { status: 400 });
        }

        return NextResponse.json({ success: true, record: updatedMed });
    } catch (error) {
        console.error("MED CRUD Error:", error);
        return NextResponse.json({ success: false, error: "Fallo en Auditoría de Medicamentos" }, { status: 500 });
    }
}
