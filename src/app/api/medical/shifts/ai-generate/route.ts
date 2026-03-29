import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy"
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;
        const body = await req.json();
        const { weekStartDate, employees, rules } = body;

        if (!weekStartDate || !employees || employees.length === 0) {
            return NextResponse.json({ error: 'Missing week data or active employees' }, { status: 400 });
        }

        const countAM = rules?.countAM || 3;
        const countPM = rules?.countPM || 3;
        const countNight = rules?.countNight || 2;

        // Create prompt context
        const weekStart = new Date(weekStartDate);
        const days = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return d.toISOString().split('T')[0];
        });

        const empContext = employees.map((e: any) => {
            let desc = `- ${e.name} (ID: ${e.id}, Role: ${e.role})`;
            const restrictions = [];
            if (e.preferredShift) restrictions.push(`DEBE SER TURNO FIJO EN: ${e.preferredShift}`);
            if (e.offDays && e.offDays.length > 0) restrictions.push(`DÍAS LIBRES FIJOS QUE NO TRABAJA: ${e.offDays.join(", ")}`);
            if (restrictions.length > 0) desc += ` [RESTRICCIONES ESTRICTAS: ${restrictions.join(" | ")}]`;
            return desc;
        }).join('\n');

        const systemPrompt = `Eres un motor matemático estricto de Inteligencia Artificial para Rosterización de Clínicas Geriátricas.
Misión: Cumplir matemáticamente con las cuotas requeridas de personal por turno, acatando CIENTÍFICAMENTE las restricciones de días y turnos fijos de cada individuo.

Días a planificar: ${days.join(", ")}
El formato de los días libres está en Inglés (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday), cerciórate de cruzar bien las fechas.

Personal Disponible:
${empContext}

Bloques de Turnos Y SUS METAS (ESTO ES OBLIGATORIO Y NO NEGOCIABLE PARA CADA DÍA):
- MORNING (AM): EXACTAMENTE ${countAM} empleados cada día.
- EVENING (PM): EXACTAMENTE ${countPM} empleados cada día.
- NIGHT (Noche): EXACTAMENTE ${countNight} empleados cada día.

Reglas Científicas:
1. SI UN EMPLEADO TIENE RESTRICCIONES ESTRICTAS, SUS TURNOS DEBEN OBEDECERLAS CIEGAMENTE (ej. Si su Turno Fijo es MORNING, no lo puedes mandar a PM ni a NIGHT, NUNCA. Si su día libre es Wednesday, no le asignas turno para el día Wednesday).
2. Cumple las METAS NUMÉRICAS (${countAM} AM, ${countPM} PM, ${countNight} Noche).
3. Evita turnos dobles o seguidos que violen el descanso humano de 8-12 horas.
4. Para los empleados sin "Turno Fijo" asignado, rótalos matemáticamente para tapar los huecos y lograr las Metas Numéricas asegurándoles al menos de 1 a 2 días libres aleatorios a la semana.

Responde ÚNICAMENTE con un array JSON válido bajo la clave "shifts". Cada objeto debe tener:
- employeeId: (ID string del empleado)
- date: (YYYY-MM-DD coincidiendo con los Días a planificar)
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
