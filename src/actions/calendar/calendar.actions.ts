"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/** 
 * Enums replicados de Base de Datos para Type Safety
 */
export type CalendarEventType = "MEDICAL_APPOINTMENT" | "REEVALUATION_DUE" | "THERAPY" | "FACILITY_ROUTINE";
export type CalendarEventStatus = "SCHEDULED" | "COMPLETED" | "DISMISSED";

export interface PlantEventPayload {
    headquartersId: string;
    patientId?: string;
    assignedToId?: string;
    type: CalendarEventType;
    title: string;
    description?: string;
    originContext: string;
    startTime: Date;
    endTime?: Date;
}

/**
 * EL SEMBRADOR CENTRAL
 * Valida conflictos clínicos antes de inyectar en la Base de Datos Transversal.
 */
export async function plantCalendarEvent(payload: PlantEventPayload) {
    try {
        // Validación de Choque: 
        // Si es una Rutina Operativa (Baño), verificamos si hay una Cita Médica a la misma hora para ese paciente.
        if (payload.type === "FACILITY_ROUTINE" && payload.patientId) {
            const conflict = await prisma.calendarEvent.findFirst({
                where: {
                    patientId: payload.patientId,
                    type: "MEDICAL_APPOINTMENT",
                    status: "SCHEDULED",
                    startTime: { lte: payload.startTime },
                    endTime: { gte: payload.startTime } // Simplificado para simulación
                }
            });

            if (conflict) {
                return { success: false, error: "CONFLICT_CLINICAL_OVERRIDE", message: "La rutina operativa choca con una Cita Médica Obligatoria." };
            }
        }

        const newEvent = await prisma.calendarEvent.create({
            data: {
                ...payload,
                status: "SCHEDULED"
            }
        });

        revalidatePath("/calendar");
        return { success: true, data: newEvent };

    } catch (error) {
        console.error("[Calendar Bus] Fallo en la Siembra:", error);
        return { success: false, error: "Error inyectando en Bus Temporal." };
    }
}

/**
 * LECTOR PROTEGIDO
 * Todo recordatorio cruzará por este filtro RLS obligatorio.
 */
export async function getCalendarEvents(hqId: string, role: string, userId: string, dateRange: { start: Date, end: Date }) {
    try {
        const query: any = {
            headquartersId: hqId,
            startTime: { gte: dateRange.start, lte: dateRange.end }
        };

        // RLS Táctico
        if (role === "CAREGIVER") {
            query.assignedToId = userId;
        }

        const events = await prisma.calendarEvent.findMany({
            where: query,
            orderBy: { startTime: "asc" },
            include: { patient: { select: { name: true } } }
        });

        return { success: true, data: events };
    } catch (error) {
        return { success: false, error: "Fallo leyendo el Bus." };
    }
}

/**
 * DESCARTADOR
 * Solo los eventos FACILITY_ROUTINE pueden descartarse de la línea del tiempo.
 */
export async function dismissCalendarEvent(eventId: string, reason: string) {
    try {
        const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
        
        if (!event || event.type === "MEDICAL_APPOINTMENT" || event.type === "REEVALUATION_DUE") {
            return { success: false, error: "Los Eventos Clínicos Vitales NO PUEDEN SER DESCARTADOS (Silenciados)." };
        }

        await prisma.calendarEvent.update({
            where: { id: eventId },
            data: { 
                status: "DISMISSED", 
                description: `${event.description || ''} \n[DISMISSED]: ${reason}` 
            }
        });

        revalidatePath("/calendar");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Fallo al silenciar evento." };
    }
}

/**
 * CERRADOR UNIVERSAL
 * Todo evento, al ejecutarse, debe firmarse como "COMPLETED".
 */
export async function completeCalendarEvent(eventId: string, notes: string) {
    try {
        await prisma.calendarEvent.update({
            where: { id: eventId },
            data: { 
                status: "COMPLETED", 
                description: notes 
            }
        });

        revalidatePath("/calendar");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Fallo al completar evento cruzado." };
    }
}
