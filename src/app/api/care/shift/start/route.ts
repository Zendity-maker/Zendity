import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const { caregiverId, headquartersId, initialCensus } = await req.json();

        if (!caregiverId || !headquartersId || typeof initialCensus !== 'number') {
            return NextResponse.json({ success: false, error: "Datos incompletos o census inválido (requiere caregiverId, headquartersId, initialCensus)" }, { status: 400 });
        }

        // FIX: Auto-cerrar sesiones huérfanas del mismo cuidador (>14h sin cerrar).
        // Evita que queden sesiones fantasma si el tablet no cierra sesión explícitamente.
        const fourteenHoursAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const autoClosed = await prisma.shiftSession.updateMany({
            where: {
                caregiverId,
                actualEndTime: null,
                startTime: { lt: fourteenHoursAgo }
            },
            data: {
                actualEndTime: new Date()
            }
        });
        if (autoClosed.count > 0) {
            console.log(`[shift/start] Auto-cerradas ${autoClosed.count} sesiones huérfanas del cuidador ${caregiverId}`);
        }

        // Verificar si ya hay una sesión activa reciente (últimas 14h)
        const activeSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId,
                actualEndTime: null, // Sigue activa
                startTime: { gte: fourteenHoursAgo }
            }
        });

        if (activeSession) {
            return NextResponse.json({ success: true, message: "Ya existe un turno activo", shiftSession: activeSession });
        }

        const newSession = await prisma.shiftSession.create({
            data: {
                caregiverId,
                headquartersId,
                initialCensus,
                startTime: new Date()
            }
        });

        // --- FASE 44: Verificar Relevos Pendientes (Clock-In Lock) ---
        const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
        const pendingHandover = await prisma.shiftHandover.findFirst({
            where: {
                headquartersId,
                status: 'PENDING',
                createdAt: { gte: eightHoursAgo }
            },
            orderBy: { createdAt: 'desc' },
            include: {
                outgoingNurse: { select: { name: true } },
                notes: true
            }
        });

        if (pendingHandover) {
            return NextResponse.json({
                success: true,
                shiftSession: newSession,
                requireHandoverAccept: true,
                pendingHandover
            });
        }
        // -------------------------------------------------------------

        return NextResponse.json({ success: true, shiftSession: newSession });

    } catch (error) {
        console.error("Shift Start Error:", error);
        return NextResponse.json({ success: false, error: "Fallo registrando el inicio de turno" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const caregiverId = searchParams.get('caregiverId');

        if (!caregiverId) {
            return NextResponse.json({ success: false, error: "caregiverId es requerido" }, { status: 400 });
        }

        // Ventana rodante de 14h (no "hoy UTC") para evitar falsos negativos al cruzar medianoche UTC
        const fourteenHoursAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const activeSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId,
                actualEndTime: null,
                startTime: { gte: fourteenHoursAgo }
            }
        });

        return NextResponse.json({ success: true, activeSession });

    } catch (error) {
        console.error("Shift GET Error:", error);
        return NextResponse.json({ success: false, error: "Error obteniendo sesión" }, { status: 500 });
    }
}
