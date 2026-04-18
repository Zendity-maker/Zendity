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

        if (type === 'ROTACION') {
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
            // Usa ClinicalNote genérico ya que no hay tabla de pañales específica aún
            let notes = "";
            if (type === 'SECO') notes = "[RONDA NOCTURNA ZENDI] Control de continencia: Pañal Seco. Sin novedades.";
            if (type === 'HUMEDO') notes = "[RONDA NOCTURNA ZENDI] Cambio de pañal por humedad regular. Higiene realizada.";
            if (type === 'EVACUACION') notes = "[RONDA NOCTURNA ZENDI] Cambio de pañal por evacuación. Higiene mayor realizada y piel protegida.";

            await prisma.clinicalNote.create({
                data: {
                    patientId,
                    authorId,
                    title: `Ronda de Cuidado (${type})`,
                    content: notes,
                    type: "PROGRESS_NOTE"
                }
            });
            return NextResponse.json({ success: true, message: 'Nota clínica de ronda guardada' });
        }
    } catch (error: any) {
        console.error("Night Rounds Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
