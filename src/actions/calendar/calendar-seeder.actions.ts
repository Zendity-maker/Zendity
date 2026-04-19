"use server";

import { plantCalendarEvent, CalendarEventType } from "./calendar.actions";

/**
 * 1. SIEMBRA DESDE INTAKE
 * Al dar de alta un Residente o prescribir medicamento a largo plazo,
 * se emite una reevaluación clínica inamovible a 6 meses.
 */
export async function seedFromIntake(hqId: string, patientId: string) {
    console.log(`[SEEDER] Intake detectado para Paciente ${patientId}. Generando Reevaluación...`);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 6);

    return await plantCalendarEvent({
        headquartersId: hqId,
        patientId,
        type: "REEVALUATION_DUE",
        title: "Reevaluación Semestral de Intake",
        description: "Revisión obligatoria del cuadro farmacológico inicial.",
        originContext: "Intake_Seeder",
        startTime: targetDate,
    });
}

/**
 * 2. SIEMBRA DESDE INCIDENTES (TRIAGE)
 * Cuando se cierra un Triage Crítico (ej. Caída Nivel 3),
 * automáticamente se agenda seguimiento obligatorio a 48 horas.
 */
export async function seedFromIncident(hqId: string, patientId: string, incidentTitle: string) {
    console.log(`[SEEDER] Incidente Crítico cerrado. Agendando seguimiento a 48H...`);
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() + 48);

    return await plantCalendarEvent({
        headquartersId: hqId,
        patientId,
        type: "REEVALUATION_DUE",
        title: `Seguimiento Clínico 48h Post-Incidente`,
        description: `Derivado de: ${incidentTitle}`,
        originContext: "Incident_Triage",
        startTime: targetDate,
    });
}

/**
 * 3. SIEMBRA DESDE PAI / LIFEPLAN
 * Genera rutinas de higiene y cuidados base (ej. Baños).
 * Estos eventos SON DISMISSIBLES y pueden ser reprogramados 
 * si chocan con una cita médica.
 */
export async function seedFromLifePlan(hqId: string, patientId: string, routineName: string, date: Date) {
    console.log(`[SEEDER] Sembrando Rutina PAI: ${routineName}`);
    
    const result = await plantCalendarEvent({
        headquartersId: hqId,
        patientId,
        type: "FACILITY_ROUTINE",
        title: routineName,
        description: "Protocolo Operativo PAI.",
        originContext: "LifePlan_Engine",
        startTime: date,
    });

    if (result.error === "CONFLICT_CLINICAL_OVERRIDE") {
        console.warn(`[SEEDER] Choque detectado. La Rutina de Piso [${routineName}] cedió el lugar a una Cita Médica.`);
        // Lógica de Reprogramación: Adelantalo 2 horas.
        const reprogrammedDate = new Date(date);
        reprogrammedDate.setHours(reprogrammedDate.getHours() + 2);
        
        return await plantCalendarEvent({
            headquartersId: hqId,
            patientId,
            type: "FACILITY_ROUTINE",
            title: `${routineName} (Reprogramado por Choque Clínico)`,
            description: "Protocolo PAI. Reprogramado automáticamente.",
            originContext: "LifePlan_Engine_Resolver",
            startTime: reprogrammedDate,
        });
    }

    return result;
}

