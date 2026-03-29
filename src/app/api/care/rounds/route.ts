import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const { patientId, authorId, hqId, type, position } = data; // type: 'SECO' | 'HUMEDO' | 'EVACUACION' | 'ROTACION'

        if (!patientId || !authorId || !type) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

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
