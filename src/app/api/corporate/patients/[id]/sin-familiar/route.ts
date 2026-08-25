import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/corporate/patients/[id]/sin-familiar   { motivo }
 * DELETE — retira la marca (aparecio un familiar despues).
 *
 * Declara EXPRESAMENTE que un residente no tiene familiar conocido.
 *
 * Existe porque "no tiene familia" y "se nos olvido preguntarlo" se veian
 * identicos en la base — ambos cero FamilyMember — y no habia forma de saber
 * a quien hay que llamar. Ahora la admision no cierra sin una de las dos
 * cosas: un familiar registrado, o esta marca puesta con su motivo.
 *
 * Pide motivo a proposito. Un booleano suelto se marca por inercia para poder
 * seguir; escribir por que obliga a pensarlo un segundo, y deja constancia de
 * quien lo decidio.
 */
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SOCIAL_WORKER', 'COORDINATOR', 'NURSE'];

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;
        const { motivo } = await req.json();

        const limpio = (motivo || '').trim();
        if (limpio.length < 10) {
            return NextResponse.json(
                { success: false, error: 'Explica en una frase por qué no hay familiar (mínimo 10 caracteres).' },
                { status: 400 },
            );
        }

        const paciente = await prisma.patient.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            select: { id: true, _count: { select: { familyMembers: true } } },
        });
        if (!paciente) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }
        if (paciente._count.familyMembers > 0) {
            return NextResponse.json(
                { success: false, error: 'Este residente ya tiene familiares registrados.' },
                { status: 400 },
            );
        }

        await prisma.patient.update({
            where: { id },
            data: {
                sinFamiliarConocido: true,
                sinFamiliarMotivo: limpio,
                sinFamiliarMarcadoPorId: auth.id,
                sinFamiliarMarcadoAt: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[sin-familiar] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id } = await params;

        const r = await prisma.patient.updateMany({
            where: { id, headquartersId: auth.headquartersId },
            data: {
                sinFamiliarConocido: false,
                sinFamiliarMotivo: null,
                sinFamiliarMarcadoPorId: null,
                sinFamiliarMarcadoAt: null,
            },
        });
        if (r.count === 0) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[sin-familiar DELETE] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
