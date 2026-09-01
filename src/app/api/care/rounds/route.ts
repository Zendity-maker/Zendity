import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const data = await req.json();
        const { patientId, type, position } = data; // type: 'SECO' | 'HUMEDO' | 'EVACUACION' | 'ROTACION'

        if (!patientId || !type) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        // Tenant check
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true }
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        // authorId SIEMPRE del session — no se confía en body
        const authorId = invokerId;

        const isDayShift = data.dayShift === true;

        if (type === 'ROTACION') {
            /**
             * Guarda contra doble envio — misma que /adls/bath.
             *
             * Medido el 30-ago-2026: 3 325 rotaciones duplicadas de 17 958.
             * Mismo residente, misma posicion, misma cuidadora, con pares de UN
             * SEGUNDO de diferencia. No es solo ruido: la rotacion tardia
             * genera penalidad de -5 y un incidente HR, asi que un registro
             * doble tambien falsea el cumplimiento de UPP en la direccion
             * contraria — parece que se rota mas de lo que se rota.
             *
             * Dos minutos. Una rotacion real del mismo residente en ese lapso
             * no existe: el objetivo son 120 minutos.
             */
            const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
            const rotacionReciente = await prisma.posturalChangeLog.findFirst({
                where: { patientId, performedAt: { gte: dosMinutosAtras } },
                select: { id: true },
            });
            if (rotacionReciente) {
                // Exito, no error: la cuidadora hizo lo correcto y un rojo la
                // haria repetirlo, que es lo que causa el duplicado.
                return NextResponse.json({
                    success: true,
                    duplicada: true,
                    message: 'Esta rotación ya estaba registrada hace un momento.',
                });
            }

            await prisma.posturalChangeLog.create({
                data: {
                    patientId,
                    nurseId: authorId,
                    position: position || "Rotación General (Pre-programada Zendi)",
                    isComplianceAlert: false
                }
            });
            return NextResponse.json({ success: true, message: 'Rotación guardada' });
        } else {
            // Prefijo diferente para diurno vs nocturno para no interferir con SLA nocturno
            const prefix = isDayShift ? '[CAMBIO PAÑAL DIURNO ZENDI]' : '[RONDA NOCTURNA ZENDI]';
            let notes = "";
            if (type === 'SECO') notes = `${prefix} Control de continencia: Pañal Seco. Sin novedades.`;
            if (type === 'HUMEDO') notes = `${prefix} Cambio de pañal por humedad regular. Higiene realizada.`;
            if (type === 'EVACUACION') notes = `${prefix} Cambio de pañal por evacuación. Higiene mayor realizada y piel protegida.`;

            await prisma.clinicalNote.create({
                data: {
                    patientId,
                    authorId,
                    title: isDayShift ? `Continencia Diurna (${type})` : `Ronda de Cuidado (${type})`,
                    content: notes,
                    type: "PROGRESS_NOTE"
                }
            });
            return NextResponse.json({ success: true, message: isDayShift ? 'Cambio de pañal registrado' : 'Nota clínica de ronda guardada' });
        }
    } catch (error: any) {
        console.error("Night Rounds Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
