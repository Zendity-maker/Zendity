import { NextResponse } from 'next/server';

/**
 * Asegura que el `patient` (ya consultado por el caller) existe Y pertenece
 * a la sede del invocador.
 *
 * Patrón duplicado en múltiples endpoints del expediente del residente
 * (GET/PUT/PATCH /api/corporate/patients/[id], PATCH /rotation-protocol).
 * Factorizado aquí para una sola fuente de verdad del check HIPAA:
 *   - 404 si el paciente no existe
 *   - 403 si pertenece a otra sede (no leak cross-tenant del expediente)
 *
 * Helper SÍNCRONO sobre objeto ya consultado (no query propia) — evita
 * duplicar DB queries en hot paths como GET con includes pesados.
 *
 * Patrón de retorno espejo de `requireRole`: discriminated union
 * (T | NextResponse). Permite type narrowing en el caller sin casts `!`:
 *
 *   const patientRaw = await prisma.patient.findUnique({ where:{id}, include:{intakeData:true} });
 *   const patient = assertPatientInTenant(patientRaw, invokerHqId);
 *   if (patient instanceof NextResponse) return patient;
 *   // `patient` aquí TS lo narrowea al tipo non-null del caller — patient.intakeData OK.
 */
export function assertPatientInTenant<T extends { headquartersId: string }>(
    patient: T | null,
    hqId: string,
): T | NextResponse {
    if (!patient) {
        return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
    }
    if (patient.headquartersId !== hqId) {
        // Mensaje deliberadamente genérico — no leak de que el paciente existe en otra sede
        return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
    }
    return patient;
}
