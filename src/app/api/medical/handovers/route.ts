import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { logAudit } from '@/lib/audit';

/**
 * Quien puede ver y firmar relevos de turno.
 *
 * SUPER_ADMIN se anade el 16-sep-2026. La pagina /corporate/medical/handovers
 * pedia "SUPERADMIN" (sin guion bajo, rol que no existe en el enum Role) y esta
 * API tampoco lo admitia: la unica cuenta SUPER_ADMIN de produccion
 * (admin@zendity.com) no podia abrir los relevos por ninguno de los dos lados.
 * Arreglar solo la pagina la habria dejado viendo una pantalla vacia en vez de
 * un 403 — peor, porque un vacio se lee como "no hay relevos" y hoy hay 291 en
 * los ultimos 30 dias entre las dos sedes.
 *
 * SUPERVISOR se queda: las dos supervisoras de Cupey son quienes cierran los
 * turnos. NURSE tambien, aunque hoy no haya nadie con NURSE primario (Celia lo
 * tiene como rol secundario y entra por DIRECTOR).
 *
 * HR_MANAGER NO entra — decision del dueno, 16-sep-2026: "no necesita ver
 * relevos de turno". Los relevos son clinicos.
 */
const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

// Obtener los Relevos de Guardia (filtrados por la sede activa del invocador)
export async function GET(request: Request) {
    try {
        // requireRole en vez de getServerSession + includes: mira TAMBIEN los
        // roles secundarios y pasa por el corte de facturacion suspendida, que
        // el chequeo a mano se saltaba.
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        // Respeta el switcher de sede para DIRECTOR/ADMIN multi-HQ
        const requestedHqId = new URL(request.url).searchParams.get('hqId');
        const hqId = await resolveEffectiveHqId({ user: auth } as any, requestedHqId);

        // Auto-cierre: si el cuidador firmó (signedOutAt) el relevo debería ser ACCEPTED.
        // Nueva política: firma del cuidador = suficiente. Migra todos los PENDING con firma.
        await prisma.shiftHandover.updateMany({
            where: {
                headquartersId: hqId,
                status: 'PENDING',
                signedOutAt: { not: null },
            },
            data: { status: 'ACCEPTED', acceptedAt: new Date() },
        }).catch(() => {});

        // Limitar a los últimos 30 días para no devolver toda la historia
        // (antes no había filtro → acumulaba cientos de registros)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const handovers = await prisma.shiftHandover.findMany({
            where: {
                headquartersId: hqId,
                createdAt: { gte: thirtyDaysAgo },
            },
            include: {
                outgoingNurse: { select: { name: true, role: true } },
                incomingNurse: { select: { name: true, role: true } },
                notes: {
                    include: {
                        patient: { select: { name: true, roomNumber: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            /**
             * 400 para que los 30 dias QUEPAN de verdad.
             *
             * Con take 200 el corte real caia en el dia 22: al 30-ago-2026 habia
             * 273 filas en la ventana y se devolvian 200, asi que 73 reportes de
             * turno eran invisibles y la pantalla no decia nada. Una lista que
             * anuncia 30 dias y entrega 22 miente en silencio.
             *
             * El tope se queda porque un findMany sin limite en produccion es el
             * anti-patron de la casa. Pero ahora viaja el total: si algun dia se
             * vuelve a quedar corto, la pantalla lo dice en vez de callarlo.
             */
            take: 400,
        });

        const totalEnVentana = await prisma.shiftHandover.count({
            where: { headquartersId: hqId, createdAt: { gte: thirtyDaysAgo } },
        });

        // Se conserva el array como cuerpo —el cliente lo consume asi— y el
        // total viaja en cabecera. Cambiar la forma obligaria a tocar los tres
        // consumidores por un dato informativo.
        return NextResponse.json(handovers, {
            headers: { 'X-Total-Ventana': String(totalEnVentana) },
        });
    } catch (error) {
        console.error("GET Handover Error:", error);
        return NextResponse.json({ error: "Failed to fetch handovers" }, { status: 500 });
    }
}

// Crear un Relevo o Aceptar uno Existente
export async function POST(request: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const invokerId = auth.id;
        const invokerRole = auth.role;
        // hqId SIEMPRE de la sesion, nunca del body
        const hqId = auth.headquartersId;

        const body = await request.json();
        const { action, handoverId, shiftType, outgoingNurseId, incomingNurseId, notes } = body;

        // Acción: Enfermera Entrante (Acepta el Turno)
        if (action === "ACCEPT_HANDOVER") {
            if (!handoverId) return NextResponse.json({ error: "handoverId requerido" }, { status: 400 });

            // Tenant check: handover debe pertenecer a la sede del invocador
            const existing = await prisma.shiftHandover.findFirst({
                where: { id: handoverId, headquartersId: hqId },
                select: { id: true }
            });
            if (!existing) {
                return NextResponse.json({ error: 'Relevo no encontrado' }, { status: 404 });
            }

            const accepted = await prisma.shiftHandover.update({
                where: { id: handoverId },
                data: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date()
                }
            });
            return NextResponse.json(accepted);
        }

        // Acción: Enfermera Saliente (Entrega el Turno)
        if (action === "CREATE_HANDOVER") {
            if (!shiftType || !outgoingNurseId || !incomingNurseId || !notes || !notes.length) {
                return NextResponse.json({ error: "Faltan datos requeridos para efectuar el Relevo." }, { status: 400 });
            }

            // hqId SIEMPRE de session — nunca del body
            // outgoingNurseId debe coincidir con el invocador (o ser admitido por ADMIN/DIRECTOR)
            if (outgoingNurseId !== invokerId && !['ADMIN', 'DIRECTOR', 'SUPERVISOR'].includes(invokerRole)) {
                return NextResponse.json({ error: 'Solo puedes entregar tu propio turno' }, { status: 403 });
            }

            // Verificar que ambas enfermeras y los pacientes pertenezcan a la sede
            const [outgoing, incoming] = await Promise.all([
                prisma.user.findFirst({ where: { id: outgoingNurseId, headquartersId: hqId }, select: { id: true } }),
                prisma.user.findFirst({ where: { id: incomingNurseId, headquartersId: hqId }, select: { id: true } }),
            ]);
            if (!outgoing || !incoming) {
                return NextResponse.json({ error: 'Enfermera no encontrada en tu sede' }, { status: 404 });
            }
            const patientIds = notes.map((n: any) => n.patientId).filter(Boolean);
            if (patientIds.length > 0) {
                const validPatients = await prisma.patient.findMany({
                    where: { id: { in: patientIds }, headquartersId: hqId },
                    select: { id: true }
                });
                if (validPatients.length !== patientIds.length) {
                    return NextResponse.json({ error: 'Residente no encontrado' }, { status: 404 });
                }
            }

            const newHandover = await prisma.shiftHandover.create({
                data: {
                    headquartersId: hqId,
                    shiftType,
                    outgoingNurseId,
                    incomingNurseId,
                    status: 'PENDING',
                    notes: {
                        create: notes.map((n: any) => ({
                            patientId: n.patientId,
                            clinicalNotes: n.clinicalNotes,
                            isCritical: n.isCritical
                        }))
                    }
                }
            });

            // Audit trail — non-fatal
            await logAudit({
                headquartersId: hqId,
                performedById: invokerId,
                action: 'HANDOVER_CREATED',
                entityName: 'ShiftHandover',
                entityId: newHandover.id,
                resourceName: `Turno ${shiftType} — ${notes.length} nota(s)`,
                payloadChanges: {
                    shiftType,
                    outgoingNurseId,
                    incomingNurseId,
                    criticalNotes: notes.filter((n: any) => n.isCritical).length,
                },
                request,
            });

            return NextResponse.json(newHandover);
        }

        return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });

    } catch (error) {
        console.error("POST Handover Error:", error);
        return NextResponse.json({ error: "Failed to process handover" }, { status: 500 });
    }
}
