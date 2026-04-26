import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';



export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        // Recuperar el FamilyMember por email para obtener patientId real
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string }
        });

        if (!familyMember || !familyMember.patientId) {
            return NextResponse.json({ success: false, error: "Cuenta de familiar no vinculada." }, { status: 404 });
        }

        // Filtrar últimos 7 días para evitar sobrecarga
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const messages = await prisma.familyMessage.findMany({
            where: {
                patientId: familyMember.patientId,
                createdAt: { gte: sevenDaysAgo }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Resolver nombres de staff para que el familiar vea quién respondió
        const staffIds = [...new Set(
            messages.filter(m => m.senderType === 'STAFF').map(m => m.senderId)
        )];
        const staffUsers = staffIds.length > 0
            ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
            : [];
        const staffMap = new Map(staffUsers.map(u => [u.id, u.name]));

        const messagesWithNames = messages.map(m => ({
            ...m,
            senderName: m.senderType === 'FAMILY'
                ? familyMember.name
                : (staffMap.get(m.senderId) || 'Personal'),
        }));

        return NextResponse.json({ success: true, messages: messagesWithNames });
    } catch (e) {
        console.error("[FamilyMessages GET] Error:", e);
        return NextResponse.json({ success: false, error: "Error al cargar mensajes" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const { content, recipientType = "ADMINISTRATION" } = await req.json();

        if (!content || !content.trim()) {
            return NextResponse.json({ success: false, error: "Mensaje vacío" }, { status: 400 });
        }

        // Recuperar el FamilyMember por email para obtener patientId real
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string }
        });

        if (!familyMember || !familyMember.patientId) {
            return NextResponse.json({ success: false, error: "Cuenta de familiar no vinculada." }, { status: 404 });
        }

        const newMessage = await prisma.familyMessage.create({
            data: {
                patientId: familyMember.patientId,
                senderType: 'FAMILY',
                senderId: familyMember.id,
                content: content.trim(),
                recipientType
            }
        });

        // Notificar al equipo correspondiente según recipientType (no bloquea la respuesta)
        try {
            const patient = await prisma.patient.findUnique({
                where: { id: familyMember.patientId },
                select: { name: true, headquartersId: true }
            });

            if (patient) {
                const hqId = patient.headquartersId;
                const patientName = patient.name;
                const senderName = familyMember.name;

                // Determinar roles a notificar según destinatario
                const roles = recipientType === 'NURSING'
                    ? ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN']
                    : ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

                await notifyRoles(hqId, roles as any[], {
                    type: 'FAMILY_VISIT',
                    title: `💬 Mensaje familiar — ${patientName}`,
                    message: `${senderName}: ${content.trim().slice(0, 80)}${content.trim().length > 80 ? '…' : ''}`,
                    link: '/corporate/family-messages'
                });
            }
        } catch (notifErr) {
            // No-fatal — notificación es best-effort
            console.error("[FamilyMessages POST] Notification error:", notifErr);
        }

        return NextResponse.json({ success: true, message: newMessage });
    } catch (e) {
        console.error("[FamilyMessages POST] Error:", e);
        return NextResponse.json({ success: false, error: "Error al enviar mensaje" }, { status: 500 });
    }
}
