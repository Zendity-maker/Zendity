import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';



export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const authorId = (session.user as any).id;
        const role = (session.user as any).role;

        // Limiting to Caregivers, Nurses, Supervisors
        if (!['NURSE', 'CAREGIVER', 'SUPERVISOR'].includes(role)) {
            return NextResponse.json({ success: true, moments: [] });
        }

        // 1. Pendientes de esta persona en los ULTIMOS 7 DIAS, no solo de hoy.
        //
        // Antes la ventana era `gte: todayStartAST()`, asi que el momento de
        // ayer desaparecia de la pantalla pero seguia vivo en la base. Cada dia
        // se generaba uno nuevo y el anterior quedaba huerfano: 560 acumulados
        // en 96 dias, 5.8 diarios, repartidos parejo entre todo el personal y
        // sin que nadie los viera crecer.
        //
        // Mostrando la semana, el trabajo sin terminar deja de esconderse solo.
        // Y como abajo solo se genera uno nuevo cuando NO hay ninguno pendiente,
        // la cola se limita sola: hay que resolver el que tienes antes de
        // recibir otro. Declinar ya es gratis, asi que resolverlo cuesta un
        // toque.
        //
        // Mas de 7 dias no se muestra: un mensaje sobre como amanecio alguien
        // hace tres meses no se le manda hoy a su familia.
        const today = todayStartAST();
        const haceSieteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const existingPendingMoments = await prisma.zendiFamilyMoment.findMany({
            where: {
                authorId: authorId,
                headquartersId: hqId,
                status: 'PENDING',
                createdAt: {
                    gte: haceSieteDias
                }
            },
            orderBy: { createdAt: 'asc' },
            include: {
                patient: {
                    select: { id: true, name: true, roomNumber: true }
                }
            }
        });

        if (existingPendingMoments.length > 0) {
            return NextResponse.json({ success: true, moments: existingPendingMoments });
        }

        // 2. Sin nada pendiente, se genera uno.
        // (Aqui vivia un `sevenDaysAgo` que se calculaba y no se usaba en
        // ninguna consulta, con un comentario que prometia un filtro de 7 dias
        // que no existia. La rotacion real es la de abajo: el residente cuyo
        // ultimo momento sea mas antiguo.)

        // Elegir el residente con el "family moment" más antiguo (o sin ninguno).
        // Determinístico y justo: rota entre todos los residentes activos de la
        // sede sin repetir hasta cubrir a todos. Reemplaza el picker aleatorio
        // que podía notificar al mismo paciente varias veces y omitir a otros.
        const candidates = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE'
            },
            include: {
                zendiFamilyMoments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                }
            }
        });

        if (candidates.length === 0) {
            return NextResponse.json({ success: true, moments: [] });
        }

        // Ordenar: primero los que nunca han tenido un momento (null);
        // luego por createdAt ascendente (el más antiguo primero).
        // Desempate por id para determinismo total.
        const sorted = [...candidates].sort((a, b) => {
            const aLast = a.zendiFamilyMoments[0]?.createdAt ?? null;
            const bLast = b.zendiFamilyMoments[0]?.createdAt ?? null;
            if (!aLast && !bLast) return a.id.localeCompare(b.id);
            if (!aLast) return -1;
            if (!bLast) return 1;
            const diff = aLast.getTime() - bLast.getTime();
            return diff !== 0 ? diff : a.id.localeCompare(b.id);
        });

        const randomPatient = sorted[0];

        // Retrieve some context (e.g. recent logs, vitals) to make the AI message contextual
        const recentLogs = await prisma.dailyLog.findMany({
            where: { patientId: randomPatient.id },
            orderBy: { createdAt: 'desc' },
            take: 3
        });

        let contextText = "Sin novedades recientes significativas.";
        if (recentLogs.length > 0) {
            contextText = recentLogs.map(l => l.notes).join(". ");
        }

        // 3. Prompt Gemini to generate 2 positive message options
        const prompt = `
        Eres Zendi, la IA asistenta de la residencia clínica de adultos mayores. 
        Tu objetivo es redactar 2 opciones de mensajes cortos, positivos y amigables para enviar al familiar del residente llamado: "${randomPatient.name}".

        El empleado que enviará este mensaje es un(a) ${role}. 
        Contexto clínico reciente del paciente (si aplica): "${contextText}"

        Reglas:
        - Las opciones deben ser optimistas.
        - Saludo inicial cálido.
        - Mantenlo bajo 3 oraciones por opción.
        - NO inventes diagnósticos médicos graves, enfócate en el bienestar general, el buen ánimo, que comió bien, o que amaneció estable.
        
        Devuelve tu respuesta ESTRICTAMENTE en este formato JSON (sin markdown, sin backticks):
        {
          "option1": "texto de la opcion 1",
          "option2": "texto de la opcion 2"
        }
        `;

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(prompt);
        let textResponse = result.response.text() || "{}";

        // Limpiar backticks de markdown si la IA insiste en añadirlos a pesar de la instrucción "responseMimeType"
        textResponse = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        const aiOptions = JSON.parse(textResponse);

        if (!aiOptions.option1 || !aiOptions.option2) {
            throw new Error("Gemini did not return valid options.");
        }

        // 4. Save the generated moment to the database
        const newMoment = await prisma.zendiFamilyMoment.create({
            data: {
                patientId: randomPatient.id,
                authorId: authorId,
                headquartersId: hqId,
                status: 'PENDING',
                optionGen1: aiOptions.option1,
                optionGen2: aiOptions.option2
            },
            include: {
                patient: {
                    select: { id: true, name: true, roomNumber: true }
                }
            }
        });

        return NextResponse.json({ success: true, moments: [newMoment] });

    } catch (error: any) {
        console.error("Error generating Zendi Family Moment:", error);
        return NextResponse.json({
            success: false,
            error: error?.message || "Internal Server Error",
            stack: error?.stack
        }, { status: 500 });
    }
}
