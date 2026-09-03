import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bloqueoPorBAA } from '@/lib/acuerdos-sede';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { name, dateOfBirth, diagnostics, avdScore, diet } = body;
        // HIPAA/multi-tenant — la sede sale de la sesión, NUNCA del body
        // (antes: hqId del body permitía crear un residente en sede ajena).
        const hqId = (session.user as any).headquartersId;

        // Simulate Norton/Downton logic based on diagnostics or AVD
        const isHighRisk = avdScore >= 2 || (diagnostics || '').toLowerCase().includes('caida');

        // ── CANDADO BAA ──────────────────────────────────────────────────
        // Sin Acuerdo de Asociado Comercial firmado, Zendity no puede recibir
        // informacion de salud de un residente. Es requisito de HIPAA y protege
        // al hogar tanto como al residente. Estricto a proposito: en el momento
        // del alta nadie tiene prisa todavia, y un aviso permanente se vuelve
        // paisaje en dos semanas. Ver src/lib/acuerdos-sede.ts.
        const bloqueo = await bloqueoPorBAA(hqId);
        if (bloqueo) {
            return NextResponse.json({ success: false, error: bloqueo }, { status: 403 });
        }

        const patient = await prisma.patient.create({
            data: {
                name,
                headquartersId: hqId,
                // Fecha de ingreso = fecha de registro (regla del dueño).
                admissionDate: new Date(),
                diet: diet,
                avdScore: parseInt(avdScore, 10),
                downtonRisk: isHighRisk,
                nortonRisk: isHighRisk,
                roomNumber: 'A-101', // Assigned logically in a real app
            }
        });

        return NextResponse.json({ success: true, patient }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create patient' }, { status: 500 });
    }
}
