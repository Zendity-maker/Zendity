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

    // eMAR adherence (semana actual)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weeklyLogs = await prisma.medicationAdministration.findMany({
        where: {
            patientMedication: { patientId: patient.id },
            administeredAt: { gte: weekStart, lte: weekEnd },
        },
        select: { status: true },
    });
    const totalExpected = weeklyLogs.length;
    const totalAdministered = weeklyLogs.filter(l => l.status === 'ADMINISTERED').length;
    const emarAdherence = totalExpected > 0
        ? {
            adherenceRate: Math.round((totalAdministered / totalExpected) * 100),
            weeklyLogsCount: totalExpected,
        }
        : null;

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
