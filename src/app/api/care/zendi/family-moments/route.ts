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

        /**
         * ═══ EVENTOS ADVERSOS RECIENTES: NO SE GENERA MOMENTO ═══
         *
         * Medido en producción el 05-sep-2026: 236 de 256 alertas clínicas
         * fueron seguidas de un mensaje tranquilizador a la familia en menos
         * de tres días. Sara Díaz, con un pulso de 33 y saturación baja,
         * recibió "se encuentra bajo el cuidado atento" 20 horas después. La
         * abuela de Andrés se golpeó la cabeza contra la pared y dos días
         * después su familia leyó "estable y tranquila".
         *
         * No pasaba por un error de programación: el prompt ORDENABA ser
         * optimista y se le entregaban esas mismas notas como contexto.
         * Optimismo más mala noticia es falsificación.
         *
         * La familia de alguien que se cayó tiene que enterarse por una
         * persona que la llama, no recibir "muy estable" desde una tablet. El
         * momento vuelve solo cuando pasa la ventana; mientras tanto, el
         * canal correcto es el mensaje directo a la familia, que ya existe.
         *
         * Marcadores contados sobre las notas reales del sistema. Quedan
         * FUERA "NOTA DE TURNO" —texto libre de lo que pasó, bueno o malo, y
         * bloquear por eso apagaría el módulo entero— y las de diálisis, que
         * son rutina y no un evento adverso.
         */
        const VENTANA_EVENTO_ADVERSO_DIAS = 3;
        const desdeAdverso = new Date(Date.now() - VENTANA_EVENTO_ADVERSO_DIAS * 86400000);
        const eventoAdverso = await prisma.dailyLog.findFirst({
            where: {
                patientId: randomPatient.id,
                createdAt: { gte: desdeAdverso },
                OR: [
                    { notes: { contains: 'ALERTA', mode: 'insensitive' } },
                    { notes: { contains: 'ACCIÓN PREVENTIVA', mode: 'insensitive' } },
                    { notes: { contains: 'TRASLADO HOSPITALARIO', mode: 'insensitive' } },
                    { notes: { contains: 'se cayó', mode: 'insensitive' } },
                    { notes: { contains: 'se resbal', mode: 'insensitive' } },
                ],
            },
            orderBy: { createdAt: 'desc' },
            select: { notes: true, createdAt: true },
        });

        if (eventoAdverso) {
            return NextResponse.json({
                success: true,
                moments: [],
                omitido: {
                    residente: randomPatient.name,
                    razon: 'EVENTO_ADVERSO_RECIENTE',
                    mensaje: `No se genera un mensaje automático para ${randomPatient.name}: hubo una novedad clínica reciente. Comunícate con la familia directamente.`,
                },
            });
        }

        /**
         * ═══ CONTEXTO REAL, NO NOTAS CLÍNICAS ═══
         *
         * Antes se le pasaban las últimas 3 notas de bitácora —incluidas las
         * alertas— y se le pedía optimismo sobre ellas. Ahora recibe HECHOS
         * REGISTRADOS: cuántas comidas, cuántos baños. Natalia tiene 20
         * comidas y 6 baños en la última semana; de ahí sale un mensaje que es
         * verdad.
         *
         * No hay módulo de actividades en el sistema, así que "participó en
         * las actividades" fue SIEMPRE una invención — y se envió a familias
         * de residentes en hospicio.
         */
        const desde7 = new Date(Date.now() - 7 * 86400000);
        const [comidas, banos] = await Promise.all([
            prisma.mealLog.count({ where: { patientId: randomPatient.id, timeLogged: { gte: desde7 } } }),
            prisma.bathLog.count({ where: { patientId: randomPatient.id, timeLogged: { gte: desde7 } } }),
        ]);

        const hechos: string[] = [];
        if (comidas > 0) hechos.push(`se le registraron ${comidas} comidas en los últimos 7 días`);
        if (banos > 0) hechos.push(`se le registraron ${banos} baños o aseos en los últimos 7 días`);
        const contextText = hechos.length
            ? hechos.join('; ')
            : 'No hay hechos registrados que mencionar. Habla solo de compañía y cuidado, sin describir actividades.';

        // La modalidad de cuido CAMBIA lo que se puede decir. Hasta hoy no
        // llegaba al modelo, y por eso a familias de hospicio les escribió
        // "pronta recuperación" y "esperamos tenerlo de vuelta en casa".
        const enHospicio = randomPatient.careModality === 'HOSPICE' || randomPatient.careModality === 'PALLIATIVE';

        // 3. Prompt Gemini to generate 2 positive message options
        /**
         * El prompt decía `Las opciones deben ser optimistas`. Esa línea, junto
         * con las notas clínicas como contexto, es lo que produjo "muy estable"
         * dos días después de un golpe en la cabeza.
         *
         * Cálido y veraz a la vez SÍ existe: acompañada, cómoda, atendida,
         * tranquila. Eso sirve para una residente en hospicio y para cualquier
         * otra, y no promete nada que no sea cierto. Optimista es otra cosa —
         * es una instrucción de afirmar el bien pase lo que pase.
         */
        const prompt = `
        Eres Zendi, la asistente de una residencia de adultos mayores. Escribe 2
        opciones de mensaje breve para la familia de "${randomPatient.name}".

        Quien lo enviará es un(a) ${role}.
        Hechos registrados de esta semana: "${contextText}"
        ${enHospicio ? `
        IMPORTANTE — ${randomPatient.name} está en cuidado de HOSPICIO/PALIATIVO.
        El objetivo del cuido es su confort y su dignidad, NO su recuperación.
        · PROHIBIDO hablar de recuperación, de mejoría, de "pronto estará mejor"
          o de volver a casa. La familia ya tuvo esa conversación con su médico
          y contradecirla es cruel.
        · Habla de compañía, de confort, de que no está sola, del cuidado con
          que se le atiende.` : ''}

        Reglas, en orden de importancia:
        1. VERAZ ante todo. Solo puedes mencionar los hechos registrados que te
           di arriba. Si no te di ninguno, habla únicamente de compañía y
           cuidado.
        2. PROHIBIDO afirmar que participó en actividades, que estuvo activa,
           que caminó, que jugó o que disfrutó de algo concreto: la residencia
           NO registra actividades y eso sería inventado.
        3. PROHIBIDO afirmar mejoría, recuperación o que "está muy bien". No
           tienes cómo saberlo.
        4. Cálido y cercano, con saludo. Cálido no es lo mismo que optimista.
        5. Máximo 3 oraciones por opción.
        6. Nada de diagnósticos, medicamentos ni datos clínicos.

        Devuelve ESTRICTAMENTE este JSON (sin markdown, sin backticks):
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
