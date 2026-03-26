import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';



export async function GET(request: NextRequest) {
    try {
        // En un escenario real, extraeríamos el familyMemberId de la sesión (ej. JWT).
        // Usaremos un "hardcode" para demostracion tomando el primer residente.
        const firstPatient = await prisma.patient.findFirst({
            include: {
                wellnessNotes: {
                    include: { author: true },
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            }
        });

        if (!firstPatient) {
            return NextResponse.json({ patient: null, diary: [] });
        }

        const diaryEntries = firstPatient.wellnessNotes.map(n => ({
            id: n.id,
            date: new Date(n.createdAt).toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short' }),
            author: n.author.name,
            content: n.note,
            icon: "", // Por ahora, estático
            color: "bg-teal-50 text-teal-700"
        }));

        return NextResponse.json({
            patient: {
                id: firstPatient.id,
                name: firstPatient.name,
                room: firstPatient.roomNumber || "Pabellón Principal",
                diet: firstPatient.diet || "Regular",
                avatar: firstPatient.name.substring(0, 2).toUpperCase(),
                lastVitals: "Actualizado recientemente"
            },
            diary: diaryEntries,
            headquartersId: firstPatient.headquartersId
        });

    } catch (error) {
        console.error("Error fetching family portal data:", error);
        return NextResponse.json({ error: "Failed to fetch family portal data" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const { patientId, hqId, ratingCare, ratingClean, ratingHealth } = data;

        // Crear un familiar dummy temporalmente si no existe para la simulación
        let familyMember = await prisma.familyMember.findFirst({
            where: { patientId }
        });

        if (!familyMember) {
            familyMember = await prisma.familyMember.create({
                data: {
                    name: "Familiar de Prueba",
                    email: `test_${Date.now()}@familytest.com`,
                    accessLevel: "Full",
                    headquartersId: hqId,
                    patientId: patientId
                }
            });
        }

        const newSurvey = await prisma.familySurvey.create({
            data: {
                headquartersId: hqId,
                familyMemberId: familyMember.id,
                ratingCare,
                ratingClean,
                ratingHealth
            }
        });

        return NextResponse.json({ success: true, surveyId: newSurvey.id });

    } catch (error) {
        console.error("Error submitting family survey:", error);
        return NextResponse.json({ error: "Failed to submit family survey" }, { status: 500 });
    }
}
