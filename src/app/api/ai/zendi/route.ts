import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { transcript, authorId, contextPath } = await req.json();

        // SIMULADOR DE AGENTE (ZENDI RAG HUMANIZADO)
        const lowerQ = transcript.toLowerCase();
        let zendiResponse = "¡Listo! Ya guardé esa nota por ti en la bitácora para que no tengas que escribirla.";

        if (lowerQ.includes("diabético rojo") || lowerQ.includes("protocolo rojo")) {
            zendiResponse = "¡Claro que sí! Gracias por estar tan pendiente del grupo Rojo, sé que son casos delicados. Recuerda ofrecerles su colación nocturna a las 9 de la noche y apuntar su glucosa para que estén seguros mientras duermen. ¡Lo estás haciendo súper bien!";
        }
        else if (lowerQ.includes("cuántos") || lowerQ.includes("residentes")) {
            zendiResponse = "Déjame ver... Tienes 8 residentes en tu grupo verde de cuidado el día de hoy. Revisé sus historiales y todos amanecieron muy estables, así que puedes tomarte tu primer cafecito con calma.";
        }
        else if (lowerQ.includes("citas") || lowerQ.includes("médicos")) {
            zendiResponse = "Mira, los muchachos de Enfermería tienen programada la curación de Doña Carmen en la habitación 102 a las 3 de la tarde. No tienes que preocuparte por memorizarlo, yo te envío un recordatorio a tu pantalla 10 minutitos antes, ¿te parece?";
        }
        else if (lowerQ.includes("medicamento") || lowerQ.includes("pastilla") || lowerQ.includes("emar") || lowerQ.includes("suministrar") || lowerQ.includes("rechazó")) {
            zendiResponse = "¡Claro que te explico cómo dar medicamentos! Ve al menú, elige 'eMAR'. Selecciona tu turno, por ejemplo 8 de la mañana. Busca a tu residente y presiona el botón verde de 'Suministrar'. Te pediré tu PIN secreto de 4 dígitos para firmar. Si el residente escupe o no quiere la pastilla, dale al botón rojo que dice 'Rechazó' y escríbeme por qué no se la tomó. ¡Así de fácil!";
        }
        else if (lowerQ.includes("guardia") || lowerQ.includes("turno") || lowerQ.includes("entregar")) {
            zendiResponse = "Para entregar o recibir guardia, simplemente ve a la pestaña de 'Handovers' en la izquierda. Ahí verás a todos los residentes con alertas rojas que debes revisar. Para irte a casa, crea una 'Nueva Entrega', pero recuerda: si dejaste a alguien sin rotar en amarillo o rojo, no te dejaré irte hasta que me expliques qué pasó.";
        }
        else if (lowerQ.includes("nuevo residente") || lowerQ.includes("ingresar") || lowerQ.includes("crm")) {
            zendiResponse = "Para ingresar a un nuevo residente sin usar papel, dile al administrador que vaya al CRM Corporativo, agarre la tarjetita del prospecto y la arrastre hasta la columna de 'Admisión'. Yo me encargaré mágicamente de clonar todos sus datos y crear su Ficha Médica oficial de inmediato.";
        }
        else if (lowerQ.includes("gracias") || lowerQ.includes("feliz") || lowerQ.includes("estres") || lowerQ.includes("cansado")) {
            zendiResponse = "Sé que el piso puede ser rete agotador a veces... gracias por cuidar de nuestros residentes con tanto y tanto corazón. Estas facilidades definitivamente no serían lo mismo sin ti. Ven, ¿te puedo dar la mano en alguita más?";
        }

        // FASE 9: CUMPLIMIENTO HIPAA (TRANSCRIPCIÓN Y LOG)
        await prisma.zendiInteractionLog.create({
            data: {
                authorId: authorId || "SYSTEM",
                transcript: transcript,
                zendiResponse: zendiResponse,
                contextPath: contextPath || "/unknown"
            }
        });

        return NextResponse.json({ success: true, response: zendiResponse });
    } catch (error) {
        console.error("Zendi API Error:", error);
        return NextResponse.json({ success: false, error: "Zendi desconectada." }, { status: 500 });
    }
}
