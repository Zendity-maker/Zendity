import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { planId, signature } = await req.json();
        // HIPAA — el firmante sale de la sesión (antes userId del body → suplantación).
        const userId = auth.id;

        if (!signature || signature.length < 4) {
            return NextResponse.json({ success: false, error: "Firma Biométrica/Digital Requerida (Mínimo 4 caracteres de validación)" }, { status: 400 });
        }
        if (!planId) {
            return NextResponse.json({ success: false, error: "planId requerido" }, { status: 400 });
        }

        // Tenant check HIPAA — el plan debe pertenecer a un residente de tu sede
        const plan = await prisma.lifePlan.findUnique({
            where: { id: planId },
            select: { patient: { select: { headquartersId: true } } },
        });
        if (!plan || plan.patient?.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: "Plan fuera de tu sede" }, { status: 403 });
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
