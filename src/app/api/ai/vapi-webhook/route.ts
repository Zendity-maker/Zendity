import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

const prisma = new PrismaClient();

// Este Webhook será consumido por VAPI Platform (Server URL)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message } = body;

        // VAPI envía diferentes eventos, nos interesa el final de la llamada para ingestar el CRM
        if (message && message.type === 'end-of-call-report') {
            const { transcript, structuredData, call } = message;

            // headquartersId puede venir inyectado desde la metadata de la llamada que nosotros mismos forzamos en la petición Saliente / Entrante
            const hqId = call?.metadata?.headquartersId || null;

            if (!hqId) {
                console.warn("Vapi end-of-call ignorado. No pertenece a ninguna sede (Falta metadata.hqId)");
                return NextResponse.json({ success: true, warning: 'No HQ ID attached' });
            }

            // structuredData es llenado si activamos Funciones en Vapi o Extraction Instructions
            const prospectName = structuredData?.prospectName || "Cliente Telefónico Anónimo";
            const prospectPhone = call?.customer?.number || "Desconocido";
            const prospectEmail = structuredData?.email || "";
            const scheduledTour = structuredData?.didScheduleTour === true; // IA determinó que agendó cita
            const appointmentDate = structuredData?.tourDate || null;

            // 1. Inyectar CRM: Crear el Prospecto en el embudo
            const newLead = await prisma.cRMLead.create({
                data: {
                    headquartersId: hqId,
                    firstName: prospectName.split(" ")[0] || "Prospecto",
                    lastName: prospectName.split(" ").slice(1).join(" ") || "Telefonico",
                    phone: prospectPhone,
                    email: prospectEmail,
                    stage: scheduledTour ? "TOUR" : "PROSPECT",
                    notes: `Automated by VAPI AI Smart Receptionist. ${scheduledTour ? `Tour Agendado para ${appointmentDate}.` : 'Requirió información general.'}`
                }
            });

            // 2. Guardar la Transcripción de Inteligencia Artificial para auditoría del humano B2B
            await prisma.aITranscript.create({
                data: {
                    crmLeadId: newLead.id,
                    agentId: call.assistantId || 'vapi_agent_00',
                    transcriptText: transcript,
                    durationSeconds: call.duration || 0
                }
            });

            // 3. Activar Automatización Twilio / SendGrid (Simulado vía Webhook)
            if (scheduledTour) {
                await dispatchMarketingAutomations(newLead.id, hqId, prospectPhone, prospectEmail);

                // 4. Inyección a la Agenda Física de Outlook/Google Workspace
                await createGoogleCalendarEvent(prospectName, prospectPhone, appointmentDate);
            }

            return NextResponse.json({ success: true, leadId: newLead.id });
        }

        // Return 200 para eventos VAPI que no procesamos
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Vapi Webhook Error:", error);
        return NextResponse.json({ error: "Failed to process Vapi Event" }, { status: 500 });
    }
}

async function dispatchMarketingAutomations(leadId: string, hqId: string, phone: string, email: string) {
    try {
        // En un entorno de producción, aquí invocaríamos la librería 'twilio' y '@sendgrid/mail'
        console.log(`[Twilio Automation] Disparando SMS con Google Maps/Tour Date para el prospecto (${phone}) de la Sede HQ: ${hqId}`);

        // Log de Interacción SMS
        await prisma.interactionLog.create({
            data: {
                crmLeadId: leadId,
                type: "WHATSAPP",
                summary: "Enviado Mensaje de Confirmación de Tour vía IA Gateway."
            }
        });

        if (email) {
            console.log(`[SendGrid Automation] Disparando Email de Bienvenida y Folletos a ${email}.`);
            await prisma.interactionLog.create({
                data: {
                    crmLeadId: leadId,
                    type: "EMAIL",
                    summary: "Enviado Folleto de la Sede (Corporate PDF)."
                }
            });
        }
    } catch (e) {
        console.error("Marketing Automation Fail:", e);
    }
}

async function createGoogleCalendarEvent(prospectName: string, phone: string, rawDate: string | null) {
    try {
        console.log(`[Google Calendar] Autenticando Servicio para generar cita de Tour: ${prospectName}`);

        // Autenticación Server-to-Server B2B mediante JSON Web Token
        const auth = new google.auth.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/calendar.events']
        });

        const calendar = google.calendar({ version: 'v3', auth });

        // Parsing Básico de la fecha entregada verbalmente por la voz
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 2); // Simulación de 'próximo día disponible' a efectos prácticos
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Tour de 1 hora

        const event = {
            summary: ` Zendi Tour Admisiones: ${prospectName}`,
            description: `Residente Referido Telefónico.\nContacto: ${phone}\nExtraído por IA: ${rawDate}`,
            start: { dateTime: startDate.toISOString(), timeZone: 'America/Puerto_Rico' },
            end: { dateTime: endDate.toISOString(), timeZone: 'America/Puerto_Rico' },
        };

        // Extracción del Calendario Target (Puede vincularse a la DB de HqIntegration en un futuro)
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: event,
        });

        console.log(`[Google Calendar]  Cita Reservada en Calendario: ${response.data.htmlLink}`);
        return response.data.htmlLink;
    } catch (e: any) {
        console.error("[Google Calendar] Error Insertando Bloque (Credenciales Ausentes):", e.message);
        return null;
    }
}
