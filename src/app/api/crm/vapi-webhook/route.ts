import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';
import sgMail from '@sendgrid/mail';

// Mock/Envs for external services (In a real scenario, fetch these from DB Headquarters settings or ENVs)
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || 'mock_sid';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'mock_token';
const TWILIO_FROM = process.env.TWILIO_FROM_PHONE || '+1234567890';

const SENDGRID_KEY = process.env.SENDGRID_API_KEY || 'mock_sg_key';
sgMail.setApiKey(SENDGRID_KEY);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message } = body;

        // VAPI Webhook Validation
        if (!message) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const hqId = "hq-demo-1"; // En producción real B2B se pasa por header o se deduce del call conf

        // 1. CAPTURAR FUNCTION CALLS (Ej. book_tour)
        if (message.type === 'function-call' || message.type === 'tool-calls') {
            const functionName = message.functionCall?.name || message.toolWithToolCallList?.[0]?.toolCall?.function?.name;
            let argsStr = message.functionCall?.parameters || message.toolWithToolCallList?.[0]?.toolCall?.function?.arguments;

            const args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;

            if (functionName === 'book_tour') {
                const { firstName, lastName, phone, email, dateStr } = args;

                if (!firstName || !lastName) {
                    return NextResponse.json({
                        results: [{ toolCallId: message.toolWithToolCallList?.[0]?.toolCall?.id, result: "Error: Faltan nombres." }]
                    });
                }

                // A. Crear Prospecto en el Tablero Kanban (Zendity CRM)
                const newLead = await prisma.cRMLead.create({
                    data: {
                        headquartersId: hqId,
                        stage: 'PROSPECT',
                        firstName,
                        lastName,
                        phone: phone || null,
                        email: email || null,
                        notes: `[VAPI AI] Generado Automáticamente por Voz. Interesado en recorrido.`
                    }
                });

                // B. Crear Evento en Calendario Corporativo
                let tourDate = dateStr ? new Date(dateStr) : new Date(Date.now() + 86400000); // Mañana si falla

                await prisma.headquartersEvent.create({
                    data: {
                        headquartersId: hqId,
                        title: `Recorrido VIP: Familia ${lastName}`,
                        type: 'FAMILY_VISIT',
                        startTime: tourDate,
                        endTime: new Date(tourDate.getTime() + 3600000), // 1 Hora de Tour
                        description: `Ventas B2B: Recorrido programado vía Zendi AI Call Center. Tel: ${phone}`
                    }
                });

                // C. Disparar Omnicanalidad Asíncrona (Aviso al Prospecto)
                triggerOmnichannelWelcome(newLead.id, firstName, phone, email, tourDate);

                // D. Responder a VAPI para que la IA continúe la llamada con éxito
                const responseJSON = {
                    results: [
                        {
                            toolCallId: message.toolWithToolCallList?.[0]?.toolCall?.id || message.functionCall?.id,
                            result: `¡Éxito! El tour ha sido agendado para el ${tourDate.toLocaleString()} y el prospecto fue creado en el CRM.`
                        }
                    ]
                };

                return NextResponse.json(responseJSON);
            }

            if (functionName === 'transfer_call') {
                const { department } = args; // "enfermeria" o "administracion"
                // En un setup real, devolverías una orden VAPI para desviar la llamada (SIP o PSTN)
                return NextResponse.json({
                    results: [{ toolCallId: message.toolWithToolCallList?.[0]?.toolCall?.id, result: `Transfiriendo a ${department}...` }]
                });
            }
        }

        // 2. REPORTE POST-LLAMADA (Fin del Call)
        if (message.type === 'end-of-call-report') {
            const transcript = message.transcript || '';
            const summary = message.summary || '';
            const callId = message.call?.id || 'unknown';

            // Intenta vincular transcripción a un Lead existente del número telefónico (si es posible)
            const phone = message.call?.customer?.number;

            if (phone) {
                const lead = await prisma.cRMLead.findFirst({ where: { phone: { contains: phone } }, orderBy: { createdAt: 'desc' } });

                if (lead) {
                    await prisma.aITranscript.create({
                        data: {
                            crmLeadId: lead.id,
                            agentId: "VAPI-VOICE",
                            transcriptText: `[RESUMEN]: ${summary}\n\n[TRANSCRIPCIÓN COMPLETA]:\n${transcript}`,
                            durationSeconds: message.call?.duration || 0
                        }
                    });
                }
            }
            return NextResponse.json({ success: true, processed: 'end-of-call' });
        }

        return NextResponse.json({ status: 'ignored', type: message.type });
    } catch (error) {
        console.error('VAPI Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ============================================
// FUNCIONES OMNICANAL ASÍNCRONAS
// ============================================

const triggerOmnichannelWelcome = async (leadId: string, name: string, phone: string | null, email: string | null, date: Date) => {
    try {
        const timeFormatted = date.toLocaleString();
        const facilityLink = "https://maps.google.com/?q=Vivid+Senior+Living";

        // 1. Mensaje de Texto (Twilio)
        if (phone && TWILIO_SID !== 'mock_sid') {
            const client = twilio(TWILIO_SID, TWILIO_TOKEN);
            await client.messages.create({
                body: `¡Hola ${name}! Soy Zendi de Vivid Senior Living. Tu recorrido quedó agendado para ${timeFormatted}. Aquí tienes nuestra ubicación: ${facilityLink}. ¡Nos vemos pronto!`,
                from: TWILIO_FROM,
                to: phone
            });

            await prisma.interactionLog.create({
                data: { crmLeadId: leadId, type: 'OUTBOUND_CALL', summary: `SMS de Confirmación de Tour enviado a ${phone}` }
            });
        } else if (phone) {
            console.log(`[MOCK TWILIO SMS] TO: ${phone} -> Tour Info Sent.`);
            await prisma.interactionLog.create({
                data: { crmLeadId: leadId, type: 'OUTBOUND_CALL', summary: `[TEST] SMS MOCK de Confirmación enviado a ${phone}` }
            });
        }

        // 2. Correo de Ventas (SendGrid)
        if (email && SENDGRID_KEY !== 'mock_sg_key') {
            const msg = {
                to: email,
                from: 'admissions@vividseniorliving.com', // Verified SendGrid Sender
                subject: `Detalles de tu Visita a Vivid Senior Living`,
                text: `Estimada familia,\n\nGracias por su interés. Su visita está agendada para ${timeFormatted}. Adjunto encontrará nuestro brochure de precios base.\n\nAtentamente,\nZendity AI Team`,
                html: `<strong>Estimada familia,</strong><br><br>Gracias por su interés. Su visita corporativa está agendada para <b>${timeFormatted}</b>.<br><p>Por favor, avise a recepción a su llegada.</p>`,
            };
            await sgMail.send(msg);

            await prisma.interactionLog.create({
                data: { crmLeadId: leadId, type: 'EMAIL', summary: `Correo Institucional (Brochure) enviado a ${email}` }
            });
        } else if (email) {
            console.log(`[MOCK SENDGRID EMAIL] TO: ${email} -> Brochure Sent.`);
            await prisma.interactionLog.create({
                data: { crmLeadId: leadId, type: 'EMAIL', summary: `[TEST] Email Institucional enviado a ${email}` }
            });
        }

    } catch (e) {
        console.error("Error Triggering Omnichannel:", e);
    }
}
