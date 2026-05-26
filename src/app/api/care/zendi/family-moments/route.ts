import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import {
    PATIENT_CONGRUENCE_SELECT,
    getFamilyContentPolicy,
    filterCongruentNotes,
    buildCongruentPromptRules,
    verifyCongruentOutput,
} from '@/lib/family/congruence';



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

        // 1. Check if there are pending moments for this user today
        const today = todayStartAST();

        const existingPendingMoments = await prisma.zendiFamilyMoment.findMany({
            where: {
                authorId: authorId,
                headquartersId: hqId,
                status: 'PENDING',
                createdAt: {
                    gte: today
                }
            },
            include: {
                patient: {
                    select: { id: true, name: true, roomNumber: true }
                }
            }
        });

        if (existingPendingMoments.length > 0) {
            return NextResponse.json({ success: true, moments: existingPendingMoments });
        }

        // 2. If no pending moments, let's see if we should generate one
        // Logic: Find a patient assigned to this HQ that has not had a family moment sent in the last 7 days.
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Elegir el residente con el "family moment" más antiguo (o sin ninguno).
        // Determinístico y justo: rota entre todos los residentes activos de la
        // sede sin repetir hasta cubrir a todos. Reemplaza el picker aleatorio
        // que podía notificar al mismo paciente varias veces y omitir a otros.
        // Incluimos PATIENT_CONGRUENCE_SELECT — más abajo filtramos los que la
        // política no autoriza (HOSPICE, HOSPITAL aunque el status base no
        // refleje, etc.) para no proponer al staff momentos inadecuados.
        const candidates = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE'
            },
            select: {
                id: true,
                name: true,
                roomNumber: true,
                headquartersId: true,
                ...PATIENT_CONGRUENCE_SELECT,
                intakeData: { select: { mobilityLevel: true } },
                lifePlans: {
                    orderBy: { updatedAt: 'desc' as const },
                    take: 1,
                    select: { mobility: true, updatedAt: true, status: true },
                },
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

        // Filtrado por política familiar — descarta residentes a los que NO
        // se les debe sugerir momento auto (HOSPITAL, HOSPICE, etc.).
        const eligible = candidates.filter((c) => getFamilyContentPolicy(c).allowAutoMoments);
        if (eligible.length === 0) {
            return NextResponse.json({ success: true, moments: [] });
        }

        // Ordenar: primero los que nunca han tenido un momento (null);
        // luego por createdAt ascendente (el más antiguo primero).
        // Desempate por id para determinismo total.
        const sorted = [...eligible].sort((a, b) => {
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

        // Filtrado de notas por congruencia — PEG → quita las que mencionan comida;
        // BEDRIDDEN → quita las que mencionan actividad.
        const rawNotes: string[] = recentLogs.map((l) => l.notes).filter((n): n is string => !!n);
        const congruentNotes = filterCongruentNotes(randomPatient, rawNotes);

        // Regla "o nada": si tras filtrar no hay contexto concreto, NO ofrezcas
        // sugerencias al staff. Mejor cero opciones que opciones falsas.
        if (congruentNotes.length === 0) {
            return NextResponse.json({ success: true, moments: [], skipped: 'no-congruent-context' });
        }

        const contextText = congruentNotes.join('. ');

        // 3. Prompt Gemini con reglas duras de congruencia
        const congruenceRules = buildCongruentPromptRules(randomPatient);

        const prompt = `
Eres Zendi, la voz cálida del equipo de cuidado de una residencia de adultos mayores.
Tu objetivo es redactar 2 opciones de mensajes cortos, en español, para que un(a) ${role}
las pueda enviar al familiar del residente "${randomPatient.name}".

Contexto reciente del residente (lo único que conoces):
"${contextText}"

${congruenceRules}

Reglas de forma:
- Saludo inicial cálido. 2 a 3 oraciones máx por opción.
- Solo menciona hechos del contexto recibido. NO inventes diagnósticos, comidas, actividades,
  estados de ánimo, ni nada que no esté arriba.
- Si las dos opciones que se te ocurren son iguales o si no hay nada congruente que decir,
  devuelve ambas como cadena vacía. Es mejor el silencio que un mensaje falso.

Devuelve ESTRICTAMENTE este JSON (sin markdown, sin backticks):
{
  "option1": "texto de la opción 1",
  "option2": "texto de la opción 2"
}
        `.trim();

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

        const aiOptionsRaw = JSON.parse(textResponse);

        // 4. Red final: verifica que NINGUNA opción viole los constraints.
        //    Si una viola, se descarta. Si las dos violan, no se crea el momento.
        const verified1 = verifyCongruentOutput(randomPatient, aiOptionsRaw.option1);
        const verified2 = verifyCongruentOutput(randomPatient, aiOptionsRaw.option2);

        if (!verified1 && !verified2) {
            // Diagnóstico: imprime las razones que disparó el chokepoint
            // (PEG/NPO/BEDRIDDEN derivados, HOSPICE, etc.) sin depender de
            // columnas en Patient que ya no existen.
            const policy = getFamilyContentPolicy(randomPatient);
            console.warn('[family-moments] ambas opciones descartadas por congruencia', {
                patientId: randomPatient.id,
                reasons: policy.constraints.reasons,
                option1Raw: aiOptionsRaw.option1, option2Raw: aiOptionsRaw.option2,
            });
            return NextResponse.json({ success: true, moments: [], skipped: 'incongruent-output' });
        }

        // Si solo una pasa, duplicamos para que el UI mantenga 2 opciones consistentes
        // — el staff verá la misma sugerencia repetida, señal de que el contexto era débil.
        // Mejor que ofrecer una segunda opción inventada.
        const aiOptions = {
            option1: verified1 || verified2,
            option2: verified2 || verified1,
        };

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
