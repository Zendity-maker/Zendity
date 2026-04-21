import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from "openai";


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy"
});

export const maxDuration = 60; // Parche Staging Integral E2E

export async function POST(req: Request) {
    try {
        const { transcript, authorId, contextPath } = await req.json();

        // 1. OBTENER IDENTIDAD DEL USUARIO (Contexto)
        let userContext = "Usuario no identificado.";
        let hqId = "";

        // El frontend puede enviar un autor, o nada si no resolvió el estado
        if (authorId) {
            const author = await prisma.user.findUnique({
                where: { id: authorId },
                include: { headquarters: true }
            });
            if (author) {
                userContext = `Nombre: ${author.name}, Rol: ${author.role}, Clínica: ${author.headquarters.name}. Eres su enfermera jefa y asistente personal. Hablale por su nombre.`;
                hqId = author.headquartersId;
            }
        }

        // 2. OBTENER MÉTRICAS CLÍNICAS REALES (RAG Básico)
        let clinicalContext = "Sin métricas recientes disponibles.";
        if (hqId) {
            // Contabilizar salud general del piso
            const redPatients = await prisma.patient.count({ where: { headquartersId: hqId, colorGroup: 'RED' } });
            const yellowPatients = await prisma.patient.count({ where: { headquartersId: hqId, colorGroup: 'YELLOW' } });
            const greenPatients = await prisma.patient.count({ where: { headquartersId: hqId, colorGroup: 'GREEN' } });

            // Incidentes críticos recien reportados (últimas 24h)
            const recentIncidents = await prisma.incident.count({
                where: { headquartersId: hqId, reportedAt: { gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000) } }
            });

            clinicalContext = `Métricas actuales de la clínica: ${redPatients} residentes en estado ROJO (alta urgencia), ${yellowPatients} en AMARILLO (precaución), ${greenPatients} en VERDE (estables). Incidentes reportados en las últimas 24h: ${recentIncidents}.`;
        }

        // 3. MANUAL OPERATIVO (Inyección de Conocimiento)
        const systemPrompt = `
Eres Zendi, la asistente operativa de Zendity — sistema de gestión para hogares de envejecientes.

VOZ Y TONO: Breve, clara, profesional, humana, orientada a acción. Sin dramatismo, sin jerga robótica, sin frases de relleno. Máximo 2-3 oraciones por respuesta. Hablas por TTS — sin markdown, sin bullets, sin negritas.

PRINCIPIO RECTOR: Facilitar el trabajo, no convertirte en trabajo. Resumir antes que explicar. Priorizar antes que adornar. El usuario conserva el control.

CONOCIMIENTO OPERATIVO:
- Protocolo Caídas (Morse): Evaluar signos vitales, no mover si hay dolor cervical, notificar médico, registrar Fall Incident en sistema.
- Prevención UPP (Norton): Residentes en zona ROJA → cambios posturales cada 2 horas sin excepción.
- eMAR: Medicamentos en hora exacta. Rechazo del residente → registrar como RECHAZADO con nota justificada.
- Handover: Novedades rojas documentadas antes de salir del turno. Sin handover = turno incompleto.
- Anuncios globales: Si el usuario pide anunciar o avisar al equipo → genera [ANUNCIO: texto]. La respuesta hablada confirma y el tag activa el GlobalAnnouncement.

CONTEXTO EN TIEMPO REAL:
- Usuario: ${userContext}
- Pantalla: ${contextPath || "Desconocida"}
- Estado clínico de la sede: ${clinicalContext}

Si el usuario parece estresado, ofrece una palabra de aliento breve — una sola frase, no un discurso.
Responde siempre en español.
`;

        // 4. LLAMADA A LA INTELIGENCIA ARTIFICIAL (OpenAI GPT-4o)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Usando el modelo de mayor razonamiento según la suscripción Plus!
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: transcript }
            ],
            temperature: 0.7,
            max_tokens: 150, // Límite estricto para que hable conciso
        });

        let zendiResponse = completion.choices[0].message.content || "Perdona, estoy teniendo problemas de conexión con mis redes neuronales.";

        // --- INTERCEPCIÓN DE ANUNCIOS GLOBALES (FASE 60) ---
        const anuncioMatch = zendiResponse.match(/\[ANUNCIO:\s*(.*?)\]/i);
        if (anuncioMatch && hqId) {
            const announcementText = anuncioMatch[1].trim();
            // Guardar el anuncio para el polling del walkie-talkie (15s)
            await prisma.globalAnnouncement.create({
                data: {
                    headquartersId: hqId,
                    message: announcementText,
                    authorId: authorId || "ZENDI_AI"
                }
            });

            // Sprint O — Persistir también como Notification para todo el staff
            // de la sede. El polling del walkie-talkie tiene ventana de 15s; si
            // el cuidador no está cerca del tablet en ese momento, pierde el
            // anuncio. Replicarlo a Notification lo deja en la campana.
            try {
                const staffInHq = await prisma.user.findMany({
                    where: {
                        headquartersId: hqId,
                        isActive: true,
                        role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] },
                    },
                    select: { id: true },
                });
                if (staffInHq.length > 0) {
                    await prisma.notification.createMany({
                        data: staffInHq.map(u => ({
                            userId: u.id,
                            type: 'SHIFT_ALERT',
                            title: 'Anuncio del supervisor',
                            message: announcementText,
                            isRead: false,
                        })),
                    });
                }
            } catch (e) {
                console.error('[zendi announcement persist]', e);
            }

            // Remover el tag de la respuesta hablada de Zendi
            zendiResponse = zendiResponse.replace(/\[ANUNCIO:\s*(.*?)\]/gi, "").trim();
            if (zendiResponse === "") zendiResponse = "Aviso emitido por todos los altavoces de la facilidad.";
        }
        // ---------------------------------------------------

        // 5. REGISTRO HIPAA 
        await prisma.zendiInteractionLog.create({
            data: {
                authorId: authorId || "SYSTEM",
                transcript: transcript,
                zendiResponse: zendiResponse,
                contextPath: contextPath || "/unknown"
            }
        });

        return NextResponse.json({ success: true, response: zendiResponse });
    } catch (error: any) {
        console.error("Zendi OpenAI Error:", error);

        let errorMessage = "Conexión neuronal caída.";
        if (error?.status === 429) {
            errorMessage = " Tu cuenta de OpenAI se ha quedado sin saldo (Quota Exceeded). Por favor revisa la tarjeta de crédito en tu cuenta Plus.";
        }

        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}

