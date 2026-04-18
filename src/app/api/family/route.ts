import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



export async function GET(_request: NextRequest) {
    try {
        // Auth: solo usuarios FAMILY pueden consumir este endpoint.
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        // En auth.ts el callback de sesión setea session.user.id = family.patientId
        // para usuarios FAMILY, así que ya tenemos el patientId ligado a la sesión.
        const patientId = (session.user as any).id as string;
        const sessionHqId = (session.user as any).headquartersId as string;

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                wellnessNotes: {
                    include: { author: true },
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            }
        });

        if (!patient) {
            return NextResponse.json({ patient: null, diary: [] });
        }

        // Tenant check: el paciente debe pertenecer a la sede de la sesión.
        if (patient.headquartersId !== sessionHqId) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const diaryEntries = patient.wellnessNotes.map(n => ({
            id: n.id,
            date: new Date(n.createdAt).toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short' }),
            author: n.author.name,
            content: n.note,
            icon: "", // Por ahora, estático
            color: "bg-teal-50 text-teal-700"
        }));

        return NextResponse.json({
            patient: {
                id: patient.id,
                name: patient.name,
                room: patient.roomNumber || "Pabellón Principal",
                diet: patient.diet || "Regular",
                avatar: patient.name.substring(0, 2).toUpperCase(),
                lastVitals: "Actualizado recientemente"
            },
            diary: diaryEntries,
            headquartersId: patient.headquartersId
        });

    } catch (error) {
        console.error("Error fetching family portal data:", error);
        return NextResponse.json({ error: "Failed to fetch family portal data" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Auth: solo FAMILY puede enviar encuestas desde el portal familiar.
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const sessionPatientId = (session.user as any).id as string;
        const sessionHqId = (session.user as any).headquartersId as string;

        const data = await request.json();
        const { patientId, ratingCare, ratingClean, ratingHealth } = data;

        // El familiar solo puede evaluar a su propio paciente.
        if (!patientId || patientId !== sessionPatientId) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
        }

        // Resolver el FamilyMember real desde la sesión (sin crear dummies).
        const familyMember = await prisma.familyMember.findFirst({
            where: { email: (session.user as any).email, patientId: sessionPatientId }
        });

        if (!familyMember) {
            return NextResponse.json({ success: false, error: "Familiar no encontrado" }, { status: 404 });
        }

        // Tenant check defensivo.
        if (familyMember.headquartersId !== sessionHqId) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const newSurvey = await prisma.familySurvey.create({
            data: {
                headquartersId: familyMember.headquartersId,
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
