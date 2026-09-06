import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { todayStartAST } from '@/lib/dates';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { requireRole } from '@/lib/api-auth';

/**
 * QUIEN PUEDE VER Y ESCRIBIR EL eMAR.
 *
 * Esta ruta comprobaba UNICAMENTE que hubiera sesion iniciada. No miraba el rol
 * y, en el POST, tampoco la sede.
 *
 * LO QUE ESO SIGNIFICABA, medido en Cupey el 05-sep-2026:
 *
 *   · El GET devolvia 33 residentes con sus 261 medicamentos activos a
 *     CUALQUIER cuenta con sesion en la sede. Tres cuentas activas no clinicas
 *     tienen headquartersId de Cupey: cocina, mantenimiento y un INVERSIONISTA.
 *     Un inversionista con la lista de medicacion de cada residente no es un
 *     detalle de permisos.
 *
 *   · El POST escribia una administracion de medicamento —firmada con el id de
 *     quien llamara— sin comprobar rol NI sede. `patientMedicationId` venia del
 *     body y nada verificaba que ese medicamento fuera de un residente de la
 *     sede del invocador. O sea: fuga multi-tenant en escritura, sobre el
 *     registro clinico que dice quien recibio que farmaco.
 *
 * Ver las preguntas 1, 2 y 3 de la auditoria proactiva en CLAUDE.md. Las tres
 * fallaban en el mismo archivo.
 */
/**
 * LEER el roster. SOCIAL_WORKER incluido, con el mismo criterio que ya estaba
 * decidido en /api/emar/patient/[id]: trabajo social lee el eMAR del residente
 * para contextualizar su caso. Como ya puede leerlo uno a uno, bloquearle el
 * listado no protegeria nada y si podria romperle una pantalla.
 */
const VEN_EMAR = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER'];

/**
 * ESCRIBIR una administracion. SOCIAL_WORKER fuera — la decision ya estaba
 * tomada y escrita en /api/emar/patient/[id]: "la administracion de meds vive
 * en /api/care/meds/bulk y /api/emar/route.ts (escritura), donde SW NO esta".
 * Hasta hoy esa frase describia una intencion que el codigo no cumplia.
 */
const ADMINISTRAN = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// PHI audit (Pilar 1) — roster eMAR de la sede (lista).
export const GET = withPhiAccessLog(getEmarRosterHandler, { resourceType: 'eMAR' });

async function getEmarRosterHandler(req: Request) {
    try {
        const auth = await requireRole(VEN_EMAR);
        if (auth instanceof NextResponse) return auth;

        const hqId = auth.headquartersId;
        const todayStart = todayStartAST();
        const todayEnd = new Date();

        // 1. Obtener todos los residentes de la HQ que tengan medicación activa
        // Excluye DISCHARGED y DECEASED (alineado con convención estándar
        // del resto de endpoints). TEMPORARY_LEAVE sí aparece — historial de
        // meds sigue siendo relevante durante hospitalización.
        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
            },
            include: {
                medications: {
                    where: { isActive: true },
                    include: {
                        medication: true,
                        // Traer solo las administraciones de HOY para ver si ya se le dio el fármaco
                        administrations: {
                            where: {
                                administeredAt: {
                                    gte: todayStart,
                                    lte: todayEnd
                                }
                            },
                            orderBy: { administeredAt: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        // 2. Mapear al modelo DTO que espera el Frontend eMAR
        const payload = patients.map((p: any) => {
            return {
                id: p.id,
                name: p.name,
                room: p.roomNumber || 'Piso General',
                medications: p.medications.map((pm: any) => {
                    const latestAdmin = pm.administrations[0];
                    return {
                        id: pm.id,
                        name: pm.medication.name,
                        dosage: pm.medication.dosage,
                        route: pm.medication.route,
                        time: pm.frequency === 'PRN' ? 'PRN' : pm.scheduleTimes, // Tratamiento simple inicial
                        instructions: pm.instructions || 'Dosis Estándar',
                        status: latestAdmin ? latestAdmin.status : 'PENDING' // ADMINISTERED, REFUSED, OMITTED
                    };
                })
            };
        });

        // Filtrar residentes que no tienen medicaciones para no ensuciar el dashboard
        const activePayload = payload.filter((p: any) => p.medications.length > 0);

        return NextResponse.json({ success: true, patients: activePayload });

    } catch (error) {
        console.error('Error fetching eMAR Roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ADMINISTRAN);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json();
        const { patientMedicationId, status, notes, scheduledFor } = body;
        // El firmante SIEMPRE sale de la sesion, nunca del body.
        const nurseId = auth.id;

        // Validaciones Cero-Error
        if (!patientMedicationId || !status) {
            return NextResponse.json({ error: 'Faltan parámetros biométricos' }, { status: 400 });
        }

        /**
         * El medicamento tiene que ser de un residente de ESTA sede.
         *
         * Faltaba por completo: `patientMedicationId` llegaba del body y se
         * escribia sin comprobar nada. Cualquiera con sesion en cualquier sede
         * podia firmar una administracion sobre el expediente de un residente
         * de otra.
         */
        const receta = await prisma.patientMedication.findFirst({
            where: { id: patientMedicationId, patient: { headquartersId: auth.headquartersId } },
            select: { id: true },
        });
        if (!receta) {
            return NextResponse.json({ error: 'Medicamento no encontrado en tu sede' }, { status: 404 });
        }

        // Crear el registro inmutable en PostgreSQL
        const adminLog = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById: nurseId,
                status: status, // ADMINISTERED | REFUSED | OMITTED
                notes: notes || null,
                scheduledFor: scheduledFor || null
            }
        });

        return NextResponse.json({ success: true, adminLog });

    } catch (error) {
        console.error('Error saving Medication Admin:', error);
        return NextResponse.json({ error: 'Database Write Error' }, { status: 500 });
    }
}
