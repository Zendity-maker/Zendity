/**
 * src/lib/sw-evaluation/load-prefill-source.ts
 *
 * Carga toda la data del residente que el resolver de prefill necesita.
 * Centralizada acá para que prefill GET (Paso 4) y CRUD create (Paso 5) la
 * compartan — evita drift entre dos copias del mismo set de queries.
 *
 * El caller pasa hqId — esta función filtra por (patientId + hqId) para
 * forzar multi-tenant en todos los consumers.
 *
 * Devuelve null si el paciente no existe en ese HQ.
 */

import type { PrismaClient } from '@prisma/client';
import { startOfWeek, endOfWeek } from 'date-fns';
import type { PrefillSourceData } from './prefill-resolver';

export async function loadPrefillSource(
    prisma: PrismaClient,
    patientId: string,
    hqId: string,
): Promise<PrefillSourceData | null> {
    const patient = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: hqId },
        select: {
            id: true, name: true, dateOfBirth: true, admissionDate: true,
            maritalStatus: true, religion: true, birthCity: true, address: true,
            avdScore: true, downtonRisk: true, nortonRisk: true,
            hospiceStartDate: true,
            dietTexture: true, dietDiabetic: true, dietLowSodium: true,
            dietRenal: true, dietVegetarian: true,
            insurancePlanName: true, insurancePolicyNumber: true,
            medicareNumber: true, medicaidNumber: true, preferredHospital: true,
            intakeData: {
                select: {
                    diagnoses: true, medicalHistory: true,
                    mobilityLevel: true, continenceLevel: true,
                    downtonScore: true, bradenScore: true,
                },
            },
            familyMembers: {
                select: {
                    id: true, name: true, relationship: true, address: true,
                    phone: true, email: true, isPrimary: true, isLegalGuardian: true,
                },
            },
            socialWorkBenefits: {
                select: { id: true, type: true, status: true, details: true, expirationDate: true },
            },
            pressureUlcers: {
                where: { status: { in: ['ACTIVE', 'HEALING'] } },
                select: { id: true, bodyLocation: true, stage: true, status: true, identifiedAt: true },
            },
        },
    });
    if (!patient) return null;

    // eMAR adherence (semana actual) — sobre las dosis YA RESUELTAS.
    //
    // Este número acaba dentro de un documento clínico (D-3 "Cumplimiento PEA"
    // de la evaluación de TS), así que mentía donde más caro sale. Acotaba por
    // `administeredAt`, que está NULL en todo lo que no se administró —meds/bulk
    // lo escribe así a propósito, care/meds/bulk/route.ts:274—, de modo que
    // MISSED, OMITTED, REFUSED y PENDING quedaban fuera: numerador y denominador
    // eran la misma fila y salía 100% POR CONSTRUCCIÓN.
    //
    // Medido contra producción (Cupey, solo lectura, 21-sep-2026): las ocho
    // semanas desde el 27-jul daban 100%; la del 14-sep es 89% de verdad —1.795
    // de 2.027, con 232 MISSED, de las que 77 son de residentes que ya no estaban
    // y que el cron dejó de programar el 17-sep—. `createdAt` siempre tiene valor
    // y aquí nunca se aleja del evento: sobre 13.866 filas, el registro
    // retroactivo más atrasado va 2,0 h por detrás y ninguno cruza un día.
    //
    // Y no basta con cambiar el campo: por `createdAt` a secas entran las PENDING
    // al denominador y sale 3% (9 de 271 esta semana), el error contrario. Una
    // dosis PENDING no está fallada, todavía no toca. El denominador es el de
    // corporate/director-briefing:121 y corporate/trends:200, más HELD, que
    // cuenta como dosis no dada igual que en shift-closure-report.ts:340.
    //
    // Sin arreglar, igual que en /api/emar/patient/[id]: la semana se corta con
    // date-fns sobre el reloj del servidor —UTC en Vercel—, o sea que empieza el
    // domingo a las 8 PM AST. El 3,9% de las filas nace en esa franja; en reloj
    // AST la misma semana del 14-sep da 88% (1.742/1.974).
    const DOSIS_RESUELTAS = ['ADMINISTERED', 'MISSED', 'OMITTED', 'REFUSED', 'HELD'] as const;

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    // groupBy y no findMany: aquí solo hacen falta los conteos, y así la consulta
    // no crece con el volumen. Misma forma que corporate/exec-report:137.
    // Sin el filtro de estado A PROPÓSITO: hacen falta las dos cifras, y así son
    // una sola consulta y salen del mismo recuento. Las resueltas dan el
    // porcentaje; las que quedan dicen POR QUÉ no hay porcentaje.
    const porEstado = await prisma.medicationAdministration.groupBy({
        by: ['status'],
        where: {
            patientMedication: { patientId: patient.id },
            createdAt: { gte: weekStart, lte: weekEnd },
        },
        _count: { _all: true },
    });
    const cuenta = (estados: readonly string[]) =>
        porEstado.filter(r => estados.includes(r.status)).reduce((n, r) => n + r._count._all, 0);
    const totalResueltas = cuenta(DOSIS_RESUELTAS);
    const totalAdministered = porEstado.find(r => r.status === 'ADMINISTERED')?._count._all ?? 0;
    const sinResolver = porEstado.reduce((n, r) => n + r._count._all, 0) - totalResueltas;

    /**
     * Sin dosis resueltas, `adherenceRate` es null: nunca un 100% de relleno
     * dentro de un expediente.
     *
     * Pero "no hay porcentaje" tiene DOS causas distintas y el hint las decía
     * igual —"Sin registros de eMAR esta semana"—, que es falso en la segunda:
     *
     *   · no hay ninguna fila de eMAR esta semana                    → es cierto
     *   · sí las hay, todas PENDING: la semana acaba de empezar y
     *     esas dosis todavía no toca darlas                          → NO es cierto
     *
     * Hoy lunes, esta sede tiene 262 dosis PENDING y 9 resueltas: casi todos los
     * expedientes caen en el segundo caso, y a la TS le decíamos que el eMAR
     * está vacío. Por eso viaja `sinResolver`, y por eso el objeto ya no es null
     * —el hint necesita el dato para distinguirlas—.
     */
    const emarAdherence = {
        adherenceRate: totalResueltas > 0
            ? Math.round((totalAdministered / totalResueltas) * 100)
            : null,
        weeklyLogsCount: totalResueltas,
        sinResolver,
    };

    const externalServicesActiveCount = await prisma.externalServiceVisitPatient.count({
        where: {
            patientId: patient.id,
            visit: { status: 'PUBLISHED', headquartersId: hqId },
        },
    });

    return {
        patient: {
            id: patient.id, name: patient.name,
            dateOfBirth: patient.dateOfBirth, admissionDate: patient.admissionDate,
            maritalStatus: patient.maritalStatus, religion: patient.religion,
            birthCity: patient.birthCity, address: patient.address,
            avdScore: patient.avdScore, downtonRisk: patient.downtonRisk,
            nortonRisk: patient.nortonRisk, hospiceStartDate: patient.hospiceStartDate,
            dietTexture: patient.dietTexture, dietDiabetic: patient.dietDiabetic,
            dietLowSodium: patient.dietLowSodium, dietRenal: patient.dietRenal,
            dietVegetarian: patient.dietVegetarian,
            insurancePlanName: patient.insurancePlanName,
            insurancePolicyNumber: patient.insurancePolicyNumber,
            medicareNumber: patient.medicareNumber,
            medicaidNumber: patient.medicaidNumber,
            preferredHospital: patient.preferredHospital,
        },
        intakeData: patient.intakeData ?? null,
        familyMembers: patient.familyMembers,
        socialWorkBenefits: patient.socialWorkBenefits,
        activePressureUlcers: patient.pressureUlcers,
        emarAdherence,
        externalServicesActiveCount,
    };
}
