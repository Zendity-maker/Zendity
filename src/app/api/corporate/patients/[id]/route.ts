import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                headquarters: true,
                lifePlan: true,
                medications: {
                    include: {
                        medication: true,
                        administrations: {
                            orderBy: { administeredAt: 'desc' },
                            include: {
                                administeredBy: { select: { id: true, name: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: "Paciente no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ success: true, patient });

    } catch (error) {
        console.error("Fetch Patient Error:", error);
        return NextResponse.json({ success: false, error: "Error detallando paciente." }, { status: 500 });
    }
}
