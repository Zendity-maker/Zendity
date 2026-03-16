import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;
        const body = await req.json();
        const { weekStartDate, employees } = body;

        if (!weekStartDate || !employees || employees.length === 0) {
            return NextResponse.json({ error: 'Missing week data or active employees' }, { status: 400 });
        }

        // Create prompt context
        const weekStart = new Date(weekStartDate);
        const days = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return d.toISOString().split('T')[0];
        });

        const empContext = employees.map((e: any) => `- ${e.name} (ID: ${e.id}, Role: ${e.role})`).join('\n');

        const systemPrompt = `Eres un planificador experto de turnos médicos en una clínica geriátrica.
Misión: Asignar de manera equitativa e inteligente los turnos semanales para el personal activo de enfermería y cuidadores.
Días a planificar: ${days.join(", ")}
Personal Disponible:
${empContext}

Bloques fijos de Turnos:
- MORNING (Mañana): 06:00 a 14:00
- EVENING (Tarde): 14:00 a 22:00
- NIGHT (Noche): 22:00 a 06:00 (Termina al día siguiente)

Reglas:
1. Asegura que cada turno de Mañana, Tarde y Noche tenga cobertura todos los días.
2. Evita asignar turnos dobles (16h seguidas) al mismo empleado el mismo día.
3. Asegura 1 o 2 días libres por empleado a la semana.
4. Devuelve una lista JSON plana de turnos asignados sin comentarios adicionales.

Responde ÚNICAMENTE con un array JSON válido bajo la clave "shifts". Cada objeto debe tener:
- employeeId: (ID string del empleado)
- date: (YYYY-MM-DD)
- block: ("MORNING", "EVENING", "NIGHT")

EJEMPLO DE RESPUESTA:
{
  "shifts": [
    {"employeeId": "abc", "date": "2024-01-01", "block": "MORNING"},
    {"employeeId": "def", "date": "2024-01-01", "block": "NIGHT"}
  ]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Genera el Roster de turnos equitativo en JSON." }],
            response_format: { type: "json_object" }
        });

        const reply = completion.choices[0].message.content;
        if (!reply) throw new Error("Null response from OpenAI");

        const parsedContent = JSON.parse(reply);
        const aiShifts = parsedContent.shifts;

        if (!aiShifts || !Array.isArray(aiShifts)) {
            throw new Error("Invalid AI generated shift format");
        }

        // Clear existing shifts for these specific days & employees? (Optional but recommended for Full Auto)
        // For safety, let's keep existing ones or delete them first? We delete them to provide a clean slate for the week
        await prisma.shiftSchedule.deleteMany({
            where: {
                employeeId: { in: employees.map((e: any) => e.id) },
                startTime: { gte: new Date(days[0] + 'T00:00:00Z'), lt: new Date(days[6] + 'T23:59:59Z') }
            }
        });

        const newShiftsData = aiShifts.map((s: any) => {
            const baseDate = new Date(s.date);
            let start = new Date(baseDate);
            let end = new Date(baseDate);

            if (s.block === 'MORNING') {
                start.setHours(6, 0, 0, 0); end.setHours(14, 0, 0, 0);
            } else if (s.block === 'EVENING') {
                start.setHours(14, 0, 0, 0); end.setHours(22, 0, 0, 0);
            } else if (s.block === 'NIGHT') {
                start.setHours(22, 0, 0, 0); 
                end.setDate(end.getDate() + 1); // night shift ends next day
                end.setHours(6, 0, 0, 0);
            }

            return {
                headquartersId: hqId,
                employeeId: s.employeeId,
                startTime: start,
                endTime: end
            };
        });

        await prisma.shiftSchedule.createMany({
            data: newShiftsData
        });

        return NextResponse.json({ success: true, count: newShiftsData.length, message: "Roster generado exitosamente" });

    } catch (error) {
        console.error("AI Generate Error:", error);
        return NextResponse.json({ error: "Fallo generando Roster Inteligente" }, { status: 500 });
    }
}
