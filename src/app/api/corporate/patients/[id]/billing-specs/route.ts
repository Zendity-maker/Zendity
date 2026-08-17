import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';



export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);

        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "Privilegios insuficientes." }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const body = await req.json();

        // Extraer valores y asegurar que sean números (o 0 por defecto)
        const monthlyFee = parseFloat(body.monthlyFee) || 0.0;
        const adfContribution = parseFloat(body.adfContribution) || 0.0;
        
        // Calcular la porción privada automáticamente
        const privateContribution = Math.max(0, monthlyFee - adfContribution);

        // Verificar si el residente existe y pertenece a este HQ
        const patient = await prisma.patient.findUnique({
            where: { id: patientId }
        });

        if (!patient || patient.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: "Residente no encontrado o no pertenece a tu sede." }, { status: 404 });
        }

        // Actualizar datos financieros y método de pago del residente
        const updatedPatient = await prisma.patient.update({
            where: { id: patientId },
            data: {
                monthlyFee,
                adfContribution,
                privateContribution,
                // FASE 12: ACH / Cheque — solo últimos 4 dígitos
                paymentMethod:    body.paymentMethod    ?? undefined,
                achBankName:      body.achBankName      ?? undefined,
                achAccountNumber: body.achAccountNumber ?? undefined,
                achRoutingNumber: body.achRoutingNumber ?? undefined,
            }
        });

        // Auditoría: cambiar la cuota mensual mueve dinero real y antes no dejaba
        // ningún rastro. Sin esto no hay forma de reconstruir por qué una factura
        // salió por un monto distinto al de la cuota vigente hoy.
        if (
            patient.monthlyFee !== monthlyFee ||
            patient.adfContribution !== adfContribution
        ) {
            await logAudit({
                headquartersId: hqId,
                performedById: (session.user as any).id,
                action: 'STATE_CHANGED',
                entityName: 'PatientBillingSpecs',
                entityId: patientId,
                resourceName: `Cuota mensual — ${patient.name}`,
                payloadChanges: {
                    monthlyFee: { before: patient.monthlyFee, after: monthlyFee },
                    adfContribution: { before: patient.adfContribution, after: adfContribution },
                    privateContribution: { before: patient.privateContribution, after: privateContribution },
                },
                request: req,
            });
        }

        return NextResponse.json({
            success: true,
            message: "Métricas de facturación actualizadas.",
            billingSpecs: {
                monthlyFee: updatedPatient.monthlyFee,
                adfContribution: updatedPatient.adfContribution,
                privateContribution: updatedPatient.privateContribution
            }
        });

    } catch (error) {
        console.error("Error updating patient billing specs:", error);
        return NextResponse.json({ success: false, error: "Error de servidor al guardar métricas de facturación." }, { status: 500 });
    }
}
