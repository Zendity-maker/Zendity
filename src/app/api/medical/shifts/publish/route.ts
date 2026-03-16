import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;
        const body = await req.json();
        const { pdfBase64, weekLabel } = body;

        if (!pdfBase64) {
            return NextResponse.json({ error: 'Missing PDF document' }, { status: 400 });
        }

        if (!process.env.SENDGRID_API_KEY) {
            return NextResponse.json({ error: 'SendGrid is not configured on this server.' }, { status: 500 });
        }

        // Fetch all active employees for this headquarters to receive the roster
        const employees = await prisma.user.findMany({
            where: {
                headquartersId: hqId,
                isActive: true,
                role: { in: ['NURSE', 'CAREGIVER', 'SUPERVISOR'] }
            },
            select: { email: true, name: true }
        });

        if (employees.length === 0) {
            return NextResponse.json({ error: 'No active employees found to dispatch email to.' }, { status: 404 });
        }

        // SendGrid Blast
        const emails = employees.map(e => e.email);
        const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@zendity.com';

        const msg = {
            to: emails,
            from: {
                email: senderEmail,
                name: 'Zendity RH System'
            },
            subject: `🩺 Tu Horario Semanal Zendity (${weekLabel})`,
            html: `
                <div style="font-family: sans-serif; color: #334155; padding: 20px;">
                    <h2 style="color: #0f766e;">Horario Clínico Semanal</h2>
                    <p>Saludos cordiales,</p>
                    <p>La dirección de la clínica ha aprobado el roster de turnos para la semana: <strong>${weekLabel}</strong>.</p>
                    <p>Por favor, revisa el archivo PDF adjunto para ver tu horario y las zonas asignadas. Te recordamos que la puntualidad es clave para los Handovers Clínicos.</p>
                    <br/>
                    <p><em>Zendity AI Automation</em></p>
                </div>
            `,
            attachments: [
                {
                    content: pdfBase64.split("base64,")[1], // Extract base64 payload
                    filename: `Roster_${weekLabel.replace(/\//g, '-')}.pdf`,
                    type: 'application/pdf',
                    disposition: 'attachment'
                }
            ]
        };

        await sgMail.sendMultiple(msg);

        return NextResponse.json({ success: true, count: emails.length, message: "Correos enviados exitosamente" });

    } catch (error) {
        console.error("Publish Shifts Error:", error);
        return NextResponse.json({ error: "Fallo enviando los correos por SendGrid" }, { status: 500 });
    }
}
