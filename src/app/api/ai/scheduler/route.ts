import { NextResponse } from 'next/server';
import OpenAI from "openai";
import { prisma } from '@/lib/prisma';
import fs from 'fs';


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// System Contexts
const SHIFT_BLOCKS = [
    { id: "MORNING", startHour: 6, startMin: 0, endHour: 14, endMin: 0 },
    { id: "EVENING", startHour: 14, startMin: 0, endHour: 22, endMin: 0 },
    { id: "NIGHT", startHour: 22, startMin: 0, endHour: 6, endMin: 0 },
    { id: "OFFICE", startHour: 9, startMin: 0, endHour: 18, endMin: 0 }
];

const ZONE_COLORS = ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE"];

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, employees, weekStartDate, hqId } = body;

        // Validations
        if (!prompt || !employees || !weekStartDate || !hqId) {
            return NextResponse.json({ success: false, error: "Missing required parameters (prompt, employees, weekStartDate, hqId)" }, { status: 400 });
        }

        const systemPrompt = `
        Eres Zendi AI, la inteligencia corporativa especializada en recursos humanos médicos para Vivid Senior Living.
        Tu misión actual es procesar una instrucción en lenguaje natural del Supervisor para agendar y planificar los turnos semanales de su personal.
        
        CONTEXTO DE LA SEMANA A PROGRAMAR:
        Semana arranca el: ${weekStartDate} (Día Lunes de la semana)
        
        PERSONAL DISPONIBLE (JSON Array):
        ${JSON.stringify(employees.map((e: any) => ({ id: e.id, name: e.name, role: e.role })))}
        
        REGLAS DE HORARIOS (BLOQUES PERMITIDOS):
        ${JSON.stringify(SHIFT_BLOCKS.map(b => b.id))}
        - MORNING = 6:00 AM a 2:00 PM
        - EVENING = 2:00 PM a 10:00 PM
        - NIGHT = 10:00 PM a 6:00 AM (al día siguiente)
        - OFFICE = 9:00 AM a 6:00 PM
        
        COLORES DE ZONAS PERMITIDOS:
        ${JSON.stringify(ZONE_COLORS)}
        (Si el supervisor no especifica color, puede ser omitido o asignar null).
        
        INSTRUCCIONES:
        1. Analiza el requerimiento del Supervisor y extrae a qué empleados quiere asignar qué turnos, y en qué días específicos de esta semana.
        2. Relaciona los nombres con los IDs del 'PERSONAL DISPONIBLE'.
        3. Genera turnos basados en los bloques definidos. Por ejemplo, "Lunes en la mañana" significa un turno el Lunes de esta semana arrancando a las 06:00 y terminando a las 14:00.
        4. "Toda la semana" significa Lunes a Domingo de la semana proveída.
        5. DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN JSON OBJECT, sin markdown, sin texto adicional.
        El formato de salida esperado debe tener UNA SOLA propiedad llamada "shifts" que contenga el Array:
        {
          "shifts": [
            {
              "employeeId": "id-del-empleado-aqui",
              "startTime": "2024-03-04T06:00:00Z",
              "endTime": "2024-03-04T14:00:00Z",
              "zoneColor": "RED" (o null si no hay color aplicable)
            }
          ]
        }
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `PROMPT DEL SUPERVISOR:\n"${prompt}"` }
            ],
            response_format: { type: "json_object" }
        });

        const gptResponse = completion.choices[0].message.content;

        if (!gptResponse) {
            throw new Error("No response from GPT");
        }

        // GPT returns a JSON Object with a wrapper key usually, or straight depending on formatting tricks. We'll parse aggressively.
        let parsedData: any;
        let finalArray: any[] = [];
        try {
            parsedData = JSON.parse(gptResponse);

            if (parsedData && parsedData.shifts && Array.isArray(parsedData.shifts)) {
                finalArray = parsedData.shifts;
            } else if (Array.isArray(parsedData)) {
                finalArray = parsedData;
            } else {
                // Heuristic search
                const arrays = Object.values(parsedData).filter(Array.isArray);
                if (arrays.length > 0) {
                    finalArray = arrays[0] as any[];
                }
            }
        } catch (e) {
            console.error("Error parsing JSON from GPT: ", gptResponse);
            return NextResponse.json({ success: false, error: "La IA generó una respuesta no válida o incomprensible." }, { status: 500 });
        }

        try {
            fs.writeFileSync('/tmp/zendi_debug.json', JSON.stringify({
                rawGpt: gptResponse,
                parsed: parsedData,
                extractedArray: finalArray
            }, null, 2));
        } catch (e) { }

        if (finalArray.length === 0) {
            return NextResponse.json({ success: false, error: "La IA no logró extraer ningún turno (Array vacío)." }, { status: 400 });
        }

        // Prepare records for Prisma
        const recordsToInsert = finalArray.map((shift: any) => ({
            employeeId: shift.employeeId,
            startTime: new Date(shift.startTime),
            endTime: new Date(shift.endTime),
            zoneColor: shift.zoneColor || null,
            headquartersId: hqId
        }));

        // Execute bulk insert (createMany is ideal)
        const inserted = await prisma.shiftSchedule.createMany({
            data: recordsToInsert,
            skipDuplicates: true // Optional, but safe
        });

        return NextResponse.json({
            success: true,
            message: `Zendi agendó ${inserted.count} turnos correctamente.`,
            insertedCount: inserted.count,
            rawParsed: recordsToInsert
        });

    } catch (error: any) {
        console.error("Zendi Shift Scheduler Error:", error);

        // Escribir el error y la res a un txt local para debug
        try {
            fs.writeFileSync('/tmp/zendi_debug.txt', "ERROR CATCH:\n\n" + (error?.message || error?.stack || JSON.stringify(error)));
        } catch (e) { }

        return NextResponse.json({ success: false, error: error.message || "Error procesando Auto-Scheduling" }, { status: 500 });
    }
}
