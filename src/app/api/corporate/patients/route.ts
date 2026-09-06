import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { requireRole } from '@/lib/api-auth';

/**
 * QUIEN PUEDE LEER EL DIRECTORIO DE RESIDENTES.
 *
 * Esta ruta comprobaba UNICAMENTE que hubiera sesion iniciada. Y como el
 * `include` no lleva `select`, devuelve el modelo Patient COMPLETO: nombre,
 * habitacion, fecha de nacimiento, dieta, cuota mensual, ultimos digitos de
 * cuenta bancaria, motivo de egreso y la nota de fallecimiento.
 *
 * Medido en Cupey el 05-sep-2026: tres cuentas activas no clinicas tienen
 * headquartersId de la sede — cocina, mantenimiento y un INVERSIONISTA. Las
 * tres podian pedir esta lista.
 *
 * Segundo caso identico encontrado el mismo dia, despues de /api/emar. Misma
 * forma: `if (!session?.user)` y nada mas.
 *
 * Los roles salen de quien llama de verdad a esta ruta: el directorio clinico,
 * el calendario, el tablero de UPP, el briefing medico, la referencia del
 * coordinador y los modales de contacto y cita familiar. O sea clinica,
 * direccion, trabajo social y coordinacion.
 */
const VEN_DIRECTORIO = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER', 'COORDINATOR'];

/**
 * CAREGIVER entra, y no por generosidad: "Med & Zoning" esta en su menu sin
 * restriccion de rol y enlaza al briefing medico, que pide esta lista.
 * Bloquearlas les romperia una pantalla que usan hoy. La fuga que se cierra es
 * la de las cuentas NO clinicas.
 *
 * PENDIENTE, y lo digo aqui para que no se pierda: esta ruta devuelve el modelo
 * Patient ENTERO —incluye cuota mensual y ultimos digitos de cuenta bancaria—
 * porque el `include` de abajo no lleva `select`. Eso es sobre-exposicion
 * incluso para quien tiene derecho a la lista. Acotarlo toca nueve pantallas
 * que la consumen, asi que va por separado y con su propia comprobacion.
 */

// PHI audit (Pilar 1) — lista de residentes: PatientList, sin patientId único.
export const GET = withPhiAccessLog(getPatientsListHandler, { resourceType: 'PatientList' });

async function getPatientsListHandler(req: Request) {
    try {
        const auth = await requireRole(VEN_DIRECTORIO);
        if (auth instanceof NextResponse) return auth;

        const hqId = auth.headquartersId;

        // Por defecto solo activos y en licencia temporal: el calendario y la
        // admisión usan este mismo endpoint para elegir residente, y ahí un
        // fallecido no debe aparecer.
        //
        // El Directorio Global sí los necesita — pide ?incluirInactivos=1.
        // Tenía un botón "Residentes dados de baja" que filtraba sobre una
        // lista de la que el servidor ya los había quitado, así que salía
        // vacío siempre. En Cupey eso dejaba 11 expedientes inalcanzables:
        // 6 fallecidos y 5 dados de baja.
        const incluirInactivos = new URL(req.url).searchParams.get('incluirInactivos') === '1';
        const estados: ('ACTIVE' | 'TEMPORARY_LEAVE' | 'DISCHARGED' | 'DECEASED')[] = incluirInactivos
            ? ['ACTIVE', 'TEMPORARY_LEAVE', 'DISCHARGED', 'DECEASED']
            : ['ACTIVE', 'TEMPORARY_LEAVE'];

        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: estados }
            },
            include: {
                // Ultima actualizacion enviada a la familia y si hay familia a
                // quien escribirle. En Cupey 19 de 33 residentes activos no
                // tienen ningun familiar en el sistema: para esos no existe
                // deuda que reclamar, y marcarlos en rojo seria un numero que
                // nadie puede bajar.
                zendiNursingUpdates: {
                    where: { status: 'SENT' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true },
                },
                _count: { select: { familyMembers: true } },
            },
            orderBy: [
                { status: 'asc' }, // ACTIVE first
                { name: 'asc' }
            ]
        });

        // Format to simplify usage in the frontend table
        const formattedPatients = patients.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status || 'ACTIVE',
            roomNumber: p.roomNumber || 'N/A',
            colorGroup: 'UNASSIGNED',
            clinicalRisk: p.downtonRisk ? 'HIGH' : 'MODERATE',
            leaveType: p.leaveType || null,
            photoUrl: p.photoUrl || null,
            joinDate: p.createdAt,
            dischargeDate: p.dischargeDate || null,
            dischargeReason: p.dischargeReason || null,
            tieneFamilia: p._count.familyMembers > 0,
            sinFamiliarConocido: p.sinFamiliarConocido,
            ultimaActualizacionFamilia: p.zendiNursingUpdates[0]?.createdAt ?? null
        }));

        return NextResponse.json({ success: true, patients: formattedPatients });

    } catch (error: any) {
        console.error('Error fetching Master Patient Directory:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
