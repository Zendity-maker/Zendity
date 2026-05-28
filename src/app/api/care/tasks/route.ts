import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();

        // Validate required fields
        if (!body.assignedToId || !body.description) {
            return NextResponse.json(
                { success: false, error: 'assignedToId y description son requeridos.' },
                { status: 400 }
            );
        }

        const headquartersId = body.headquartersId || session.user.headquartersId;

        // kind: 'NOTE' (instrucción de cuidado, SIN penalización) | 'SLA' (tarea
        // con reloj de 15 min y penalización al score). Default NOTE — el uso
        // típico es una instrucción clínica ("dale Tylenol"), no un castigo.
        const kind: 'NOTE' | 'SLA' = body.kind === 'SLA' ? 'SLA' : 'NOTE';
        const slaMinutes = body.slaMinutes || 15;

        // Sin migración de schema: usamos marcadores en `description` (patrón ya
        // usado en el codebase). El cron health-monitor y compliance-score
        // EXCLUYEN descripciones con [NOTA] de la marca FAILED / penalización.
        // Opcional: prefijo de residente para dar contexto a la cuidadora.
        const patientName: string | undefined = typeof body.patientName === 'string' && body.patientName.trim()
            ? body.patientName.trim()
            : undefined;
        const prefix = kind === 'NOTE'
            ? `[NOTA]${patientName ? `[Residente: ${patientName}]` : ''} `
            : `${patientName ? `[Residente: ${patientName}] ` : ''}`;
        const finalDescription = `${prefix}${body.description}`;

        // NOTE: expiry lejano (30 días) → nunca lo barre el cron como FAILED.
        // Doble defensa: el marcador [NOTA] también lo excluye del sweep/score.
        // SLA: ventana real de slaMinutes (penaliza si no se cumple).
        const expiresAt = kind === 'NOTE'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + slaMinutes * 60 * 1000);

        const task = await prisma.fastActionAssignment.create({
            data: {
                headquartersId,
                supervisorId: body.assignedById || session.user.id,
                caregiverId: body.assignedToId,
                description: finalDescription,
                status: 'PENDING',
                expiresAt,
            },
        });

        return NextResponse.json({ success: true, task, kind });
    } catch (error: any) {
        console.error('Care Tasks POST Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error creando tarea.' },
            { status: 500 }
        );
    }
}
