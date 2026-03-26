import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const { planId, userId, signature } = await req.json();

        if (!signature || signature.length < 4) {
            return NextResponse.json({ success: false, error: "Firma Biométrica/Digital Requerida (Mínimo 4 caracteres de validación)" }, { status: 400 });
        }

        const approvedPlan = await prisma.lifePlan.update({
            where: { id: planId },
            data: {
                status: 'APPROVED',
                signedById: userId,
                signedAt: new Date()
            },
            include: { patient: true }
        });

        return NextResponse.json({ success: true, lifePlan: approvedPlan });

    } catch (error) {
        console.error("Signature Error:", error);
        return NextResponse.json({ success: false, error: "Error certificando PAI" }, { status: 500 });
    }
}
