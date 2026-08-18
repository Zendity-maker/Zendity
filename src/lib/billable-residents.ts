import { Prisma, PatientStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Estados de residente que generan cuota mensual.
 *
 * Regla de negocio (definida 17-ago-2026): un residente en TEMPORARY_LEAVE
 * —hospitalizado, en visita familiar, en diálisis— SIGUE PAGANDO cuota
 * completa, porque la cama se mantiene reservada. No hay prorrateo por
 * ausencia.
 *
 * Esta constante es la fuente única de verdad. Antes de existir, el criterio
 * vivía duplicado en tres archivos con DOS definiciones distintas: el censo
 * usaba ACTIVE+TEMPORARY_LEAVE y la facturación solo ACTIVE. Consecuencias
 * medidas en producción (agosto 2026):
 *
 *   - Carlos Varona Berrios ($3,200/mes) llevaba dos meses sin facturarse por
 *     estar en TEMPORARY_LEAVE.
 *   - Luz A. Martinez e Isidra Beaton SÍ se facturaron el mismo mes, con el
 *     mismo estado final, solo porque el cron corrió el día 1 antes de que
 *     cambiaran de estado. El resultado dependía del azar del calendario.
 *
 * Si mañana aparece un cuarto PatientStatus, se decide aquí y en ningún otro
 * lugar.
 */
export const BILLABLE_PATIENT_STATUSES: PatientStatus[] = ['ACTIVE', 'TEMPORARY_LEAVE'];

/**
 * Estados que cuentan como MATRÍCULA del hogar.
 *
 * Regla del dueño (17-ago-2026): un residente sigue siendo residente aunque
 * esté hospitalizado o de permiso; deja de serlo solo cuando se le da de baja
 * o egresa. Coincide con los estados facturables —la cama sigue reservada— y
 * por eso comparten valor, pero se nombran distinto porque responden a
 * preguntas distintas: cuánto se factura vs cuánta gente hay matriculada.
 *
 * NO usar para operación de turno: para saber a quién hay que bañar, medicar
 * o rotar HOY, el hospitalizado no cuenta (no está en el edificio). Ese caso
 * filtra por 'ACTIVE' a secas.
 */
export const ENROLLED_PATIENT_STATUSES: PatientStatus[] = ['ACTIVE', 'TEMPORARY_LEAVE'];

/** Cláusula `where` para contar la matrícula de una sede. */
export function enrolledResidentsWhere(hqId: string): Prisma.PatientWhereInput {
    return { headquartersId: hqId, status: { in: ENROLLED_PATIENT_STATUSES } };
}

/** ¿Este estado de residente genera cuota mensual? */
export function isBillableStatus(status: PatientStatus): boolean {
    return BILLABLE_PATIENT_STATUSES.includes(status);
}

/**
 * Cláusula `where` reutilizable para cualquier query de residentes facturables
 * de una sede. Se expone como `where` en lugar de una función que ya trae los
 * datos porque cada caller necesita un `select` distinto (el cron quiere
 * monthlyFee y familiar primario; el dropdown de recibos quiere nombre y
 * habitación). Compartir el criterio sin imponer la forma del resultado.
 */
export function billableResidentsWhere(hqId: string): Prisma.PatientWhereInput {
    return {
        headquartersId: hqId,
        status: { in: BILLABLE_PATIENT_STATUSES },
    };
}

/**
 * Residentes facturables de una sede con los campos que necesita el motor de
 * facturación mensual. Ordenados por nombre para que la numeración secuencial
 * de facturas sea estable entre corridas.
 */
export function getBillableResidents(hqId: string) {
    return prisma.patient.findMany({
        where: billableResidentsWhere(hqId),
        select: {
            id: true,
            name: true,
            status: true,
            monthlyFee: true,
            admissionDate: true,
            createdAt: true,
            primaryFamilyMemberId: true,
        },
        orderBy: { name: 'asc' },
    });
}
