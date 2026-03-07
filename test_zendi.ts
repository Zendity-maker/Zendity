import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SHIFT_BLOCKS = ["MORNING", "EVENING", "NIGHT", "OFFICE"];
const ZONE_COLORS = ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE"];

async function run() {
    const prompt = "Pon a Carlos toda la semana de Mañana en la Zona Azul. Y a Vanessa ponla el Lunes y el Martes de Tarde.";
    const employees = [
        { id: "e1-carlos", name: "Carlos", role: "NURSE" },
        { id: "e2-vanessa", name: "Vanessa", role: "CAREGIVER" }
    ];

    const systemPrompt = `
Eres Zendi AI, la inteligencia corporativa especializada en recursos humanos médicos para Vivid Senior Living.
Tu misión actual es procesar una instrucción en lenguaje natural del Supervisor para agendar y planificar los turnos semanales de su personal.

CONTEXTO DE LA SEMANA A PROGRAMAR:
Semana arranca el: 2024-03-04T00:00:00Z (Día Lunes de la semana)

PERSONAL DISPONIBLE (JSON Array):
${JSON.stringify(employees)}

REGLAS DE HORARIOS (BLOQUES PERMITIDOS):
${JSON.stringify(SHIFT_BLOCKS)}
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

    console.log("Raw Response:");
    console.log(completion.choices[0].message.content);
}

run();
