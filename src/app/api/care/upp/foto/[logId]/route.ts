import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';

export const dynamic = 'force-dynamic';

const READ_ROLES = ['NURSE', 'DIRECTOR', 'ADMIN', 'SUPERVISOR', 'CAREGIVER'];

/**
 * Sirve la foto de un registro de úlcera, de una en una.
 *
 * Va aparte a propósito. Las fotos se guardan como base64 en columna, y el
 * dashboard de UPP trae todos los registros de todas las lesiones: incluir el
 * base64 ahí haría crecer la respuesta varios MB por residente conforme se
 * acumulen curaciones. La lista devuelve solo el booleano hasPhoto; la imagen
 * se pide cuando alguien la quiere ver.
 *
 * Es PHI: exige sesión, rol de piso, y que la lesión sea de un residente de tu
 * sede.
 */
async function getFotoHandler(
    _req: Request,
    { params }: { params: Promise<{ logId: string }> }
) {
    try {
        const { logId } = await params;

        const auth = await requireRole(READ_ROLES);
        if (auth instanceof NextResponse) return auth;

        const log = await prisma.ulcerLog.findUnique({
            where: { id: logId },
            select: {
                photoUrl: true,
                ulcer: { select: { patient: { select: { headquartersId: true } } } },
            },
        });

        if (!log) {
            return NextResponse.json({ success: false, error: 'Registro no encontrado' }, { status: 404 });
        }
        // Multi-tenant: la lesión tiene que ser de un residente de tu sede.
        if (log.ulcer.patient.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: 'Fuera de tu sede' }, { status: 403 });
        }
        if (!log.photoUrl) {
            return NextResponse.json({ success: false, error: 'Este registro no tiene foto' }, { status: 404 });
        }

        return NextResponse.json({ success: true, photoUrl: log.photoUrl });
    } catch (error) {
        console.error('Error sirviendo foto de úlcera:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

// PHI audit — una foto de herida es de lo más sensible que guarda el sistema.
// Sin esto, abrirla no dejaba rastro: el resto del módulo de UPP sí se audita.
export const GET = withPhiAccessLog(getFotoHandler, {
    resourceType: 'PressureUlcerPhoto',
});
