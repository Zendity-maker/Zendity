import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyUser } from '@/lib/notifications';
import { applyScoreEvent } from '@/lib/score-event';
import { HrIncidentSeverity } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Resolver una apelación es decisión de RRHH: el supervisor que emitió la
// observación no debería ser quien juzgue su propia apelación.
const ROLES = ['DIRECTOR', 'ADMIN', 'HR_MANAGER'];

/**
 * Puntos que se devuelven si la apelación se acepta.
 *
 * Espejo de pointsFor() en el endpoint de decisión: si aceptar la apelación no
 * devuelve lo que la sanción quitó, aceptarla no significa nada.
 */
function puntosADevolver(severity: HrIncidentSeverity): number {
    switch (severity) {
        case 'OBSERVATION': return 3;
        case 'WARNING': return 8;
        case 'SUSPENSION': return 20;
        default: return 0;  // TERMINATION no descuenta puntos, pone el score a 0
    }
}

/**
 * Acepta o deniega una apelación, y le contesta al empleado.
 *
 * Hasta hoy una apelación se guardaba y ahí moría: no había forma de resolverla
 * ni de responderle a quien la escribió. En Cupey hay 25 apelaciones desde
 * mayo, ninguna contestada.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const auth = await requireRole(ROLES);
        if (auth instanceof NextResponse) return auth;

        const { outcome, responseText } = await req.json();
        if (!['ACCEPTED', 'DENIED'].includes(outcome)) {
            return NextResponse.json({ success: false, error: 'outcome debe ser ACCEPTED o DENIED' }, { status: 400 });
        }
        const texto = (responseText ?? '').trim();
        if (texto.length < 10) {
            // Una resolución sin explicación es lo mismo que el silencio de hoy.
            return NextResponse.json({ success: false, error: 'Escribe la razón de la decisión (mínimo 10 caracteres)' }, { status: 400 });
        }

        const incident = await prisma.incidentReport.findUnique({
            where: { id },
            select: {
                id: true, headquartersId: true, employeeId: true, severity: true,
                appealedAt: true, appealResolvedAt: true,
                employee: { select: { name: true } },
            },
        });
        if (!incident) {
            return NextResponse.json({ success: false, error: 'Observación no encontrada' }, { status: 404 });
        }
        if (incident.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: 'Fuera de tu sede' }, { status: 403 });
        }
        if (!incident.appealedAt) {
            return NextResponse.json({ success: false, error: 'Esta observación no tiene apelación' }, { status: 400 });
        }
        if (incident.appealResolvedAt) {
            return NextResponse.json({ success: false, error: 'Esta apelación ya fue resuelta' }, { status: 409 });
        }

        await prisma.incidentReport.update({
            where: { id },
            data: {
                appealOutcome: outcome,
                appealResponseText: texto,
                appealResolvedAt: new Date(),
                appealResolvedById: auth.id,
            },
        });

        // Aceptar devuelve los puntos que la sanción quitó. Sin esto, "aceptada"
        // sería solo una palabra en un expediente.
        let puntos = 0;
        if (outcome === 'ACCEPTED') {
            puntos = puntosADevolver(incident.severity);
            if (puntos > 0) {
                await applyScoreEvent(
                    incident.employeeId,
                    incident.headquartersId,
                    puntos,
                    'Apelación aceptada — se revierte la penalidad',
                    // Misma categoría que la sanción original, para que el
                    // historial de score muestre el castigo y su reversión juntos.
                    'INCIDENT',
                );
            }
        }

        await notifyUser(incident.employeeId, {
            type: 'EMAR_ALERT',
            title: outcome === 'ACCEPTED' ? '✅ Tu apelación fue aceptada' : 'Tu apelación fue revisada',
            message: outcome === 'ACCEPTED'
                ? `Se revisó tu apelación y se te dio la razón.${puntos > 0 ? ` Se te devolvieron ${puntos} puntos.` : ''} Entra para leer la respuesta.`
                : 'Se revisó tu apelación. Entra para leer la respuesta.',
            link: '/my-observations',
        });

        return NextResponse.json({ success: true, outcome, puntosDevueltos: puntos });
    } catch (error) {
        console.error('Error resolviendo apelación:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
