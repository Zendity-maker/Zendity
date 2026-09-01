import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyScoreEvent } from '@/lib/score-event';
import { solapaConSinServicio } from '@/lib/ventanas-sin-servicio';
import { resolverHoraReal } from '@/lib/hora-real';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const invokerHqId = (session.user as any).headquartersId;

        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado para rotaciones posturales' }, { status: 403 });
        }

        const { patientId, caregiverId, position, performedAt: horaDeclarada } = await req.json();

        // Hora real del cambio de posicion. Sin ella se usa `now()`, el
        // comportamiento de siempre. Ver src/lib/hora-real.ts.
        const hora = resolverHoraReal(horaDeclarada);
        if (!hora.ok) {
            return NextResponse.json({ success: false, error: hora.error }, { status: 400 });
        }
        const momento = hora.hora;

        if (!patientId || !caregiverId || !position) {
            return NextResponse.json({ success: false, error: "Faltan parámetros obligatorios para el cambio postural." }, { status: 400 });
        }

        // Tenant check: el paciente debe pertenecer a la sede del invocador
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            select: {
                id: true, headquartersId: true, status: true,
                requiresPosturalChanges: true, nortonRisk: true,
                pressureUlcers: { where: { status: { not: 'RESOLVED' } }, select: { id: true } },
            },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });
        }

        // Integridad adicional: el caregiverId del body debe ser el invocador o alguien de la misma sede
        if (caregiverId !== invokerId) {
            const cg = await prisma.user.findUnique({ where: { id: caregiverId }, select: { headquartersId: true } });
            if (!cg || cg.headquartersId !== invokerHqId) {
                return NextResponse.json({ success: false, error: 'Cuidador inválido' }, { status: 403 });
            }
        }

        const lastRotation = await prisma.posturalChangeLog.findFirst({
            where: { patientId },
            orderBy: { performedAt: 'desc' }
        });

        let pointsDelta = 0;
        let isLate = false;

        if (lastRotation) {
            // Contra el momento REAL de esta rotacion, no contra el reloj: si
            // ella la hizo a las 7:00 y la registra a las 8:47, la tardanza se
            // mide desde las 7:00. De lo contrario el sistema la castigaria por
            // el rato que tardo en sentarse con la tableta.
            const diffMs = momento.getTime() - new Date(lastRotation.performedAt).getTime();
            const diffMins = diffMs / (1000 * 60);

            // Objetivo 120 min. Tolerancia legal 15 mins (135 min max).
            if (diffMins > 135) {
                isLate = true;
                pointsDelta = -5; // Castigo por negligencia (strike)
            } else if (diffMins >= 60 && diffMins <= 135) {
                pointsDelta = 2;  // Recompensa operativa impecable
            }
        } else {
            // Primera rotación registrada de este paciente (Bonus inicial)
            pointsDelta = 2;
        }

        /**
         * ¿Se puede castigar por esta rotación?
         *
         * Solo si el residente REQUIERE rotación y estaba en el edificio.
         *
         * Antes no se preguntaba: se castigaba por el reloj y nada más. De las
         * 121 penalidades acumuladas, 9 son de José A. Troche mientras estaba
         * ingresado — a alguien le descontaron puntos por no girar a un señor
         * que estaba en el hospital.
         *
         * Norton por si solo NO alcanza. Es una escala de riesgo, no una orden
         * de rotación: Teresa Rivera se moviliza sola en silla de ruedas.
         * Misma regla que /api/care/nursing/rotation.
         *
         * El premio se conserva sin condición. Registrar una rotación a tiempo
         * es bueno aunque no fuera obligatoria; lo que no se puede es castigar
         * por incumplir algo que nadie mandó.
         */
        const requiereRotacion = patient.requiresPosturalChanges || patient.pressureUlcers.length > 0;
        const enElEdificio = patient.status === 'ACTIVE';
        if (pointsDelta < 0 && (!requiereRotacion || !enElEdificio)) {
            pointsDelta = 0;
        }

        /**
         * Tampoco se castiga si el hueco atraviesa una caída del sistema.
         *
         * La penalidad mira el tiempo desde la ultima rotacion. Tras la caida
         * del 28-ago —casi ocho horas sin que el personal pudiera entrar— la
         * PRIMERA rotacion que alguien registrara arrastraba el hueco entero y
         * se llevaba los -5. Es decir: se castigaba justo a quien estaba
         * cerrando el hueco, por un fallo que no era suyo.
         *
         * Ver src/lib/ventanas-sin-servicio.ts.
         */
        if (pointsDelta < 0 && lastRotation
            && solapaConSinServicio(new Date(lastRotation.performedAt), new Date())) {
            pointsDelta = 0;
        }

        // Gamificación HR (Deducción o Ganancia)
        if (pointsDelta !== 0) {
            const rotReason = pointsDelta > 0
                ? 'Rotación UPP a tiempo'
                : 'Rotación UPP retrasada (>135 min)';
            await applyScoreEvent(caregiverId, patient.headquartersId, pointsDelta, rotReason, 'ROTATION');

            // Si es un castigo, inyectamos incidente real con el headquartersId correcto del paciente
            if (pointsDelta < 0) {
                await prisma.incident.create({
                    data: {
                        patientId,
                        headquartersId: patient.headquartersId,
                        type: "ULCER",
                        severity: "MEDIUM",
                        description: `PENALIDAD HR: Cambio postural de residente retrasado por más de 135 minutos. Infracción al protocolo UPP.`,
                        biometricSignature: "zendity-ai-auditor"
                    }
                });
            }
        }

        const newRotation = await prisma.posturalChangeLog.create({
            data: {
                patientId,
                nurseId: caregiverId,
                position,
                performedAt: momento,
                isComplianceAlert: isLate
            }
        });

        return NextResponse.json({ success: true, rotation: newRotation, pointsDelta });

    } catch (error) {
        console.error("Postural Change Route Error:", error);
        return NextResponse.json({ success: false, error: "Error interno procesando el cambio postural (UPP)." }, { status: 500 });
    }
}
