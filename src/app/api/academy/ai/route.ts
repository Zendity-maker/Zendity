import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestType, courseId } = body; // 'flashcards' o 'quiz'

    if (!courseId) {
      return NextResponse.json({ success: false, error: "Course ID missing." }, { status: 400 });
    }

    // 1. Fetch Course Content from Database
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
        return NextResponse.json({ success: false, error: "Curso oficial no encontrado en el directorio." }, { status: 404 });
    }

    // Master Material: Use dynamic DB content. Fallback to a core clinical string if empty (for legacy FASE 1 courses)
    const masterMaterial = course.content && course.content.trim().length > 50
        ? course.content
        : `
Descripción del curso:
Este curso práctico y educativo está diseñado para capacitar al personal y cuidadores en la prevención de caídas y protocolos de baño, una de las principales preocupaciones en el cuidado de adultos mayores. A través de módulos interactivos, aprenderás a identificar factores de riesgo, implementar estrategias efectivas y diseñar entornos seguros que promuevan la movilidad y reduzcan accidentes.

Procedimiento en caso de caída:
- Asistir al residente sin intentar levantarlo directamente.
- Llamar al equipo de enfermería o emergencias según sea necesario.
- Permanecer con el residente, proporcionando calma y apoyo emocional.
`;

    // Dynamic Context for Gemini based on Title and Description
    const courseContext = `ENFOQUE PRINCIPAL: Este es el Curso Oficial: "${course.title}". Contexto Adicional: ${course.description}. DEBES extraer todo el contenido educativo única y exclusivamente basado en el MASTER MATERIAL provisto a continuación.`;

    // 2. Preparar el Prompt para Gemini
    let prompt = "";
    if (requestType === 'flashcards') {
      prompt = `
Eres la Profesora Zendi, líder educativa de Zendity Academy.
Lee el siguiente material oficial (Master Material) y extrae exactamente 4 tarjetas de estudio interactivas (Flashcards) resumiendo los conceptos clave.
Usa un tono profesional, motivador y directo (tipo Duolingo).

REGLAS DE CONTEXTO ESTRICTO DE ESTE CURSO ESPECÍFICO:
${courseContext}

OUTPUT OBLIGATORIO: Genera ÚNICAMENTE un JSON válido con esta estructura, sin bloques de markdown:
{
  "flashcards": [
    { "title": "Título Corto", "content": "Descripción o resumen (2-3 oraciones máximo)." }
  ]
}

MASTER MATERIAL:
${masterMaterial}
`;
    } else if (requestType === 'quiz') {
      let customInstructions = "";
      if (course.title.includes('Fase 1')) {
         customInstructions = "OBLIGATORIO: Tu examen DEBE estar basado en estas 5 preguntas exactas: 1. ¿Cuál es el rango de puntuación del principio de Autonomía según el estudio Gerokomos? 2. Defina Anciano Frágil en términos de reserva fisiológica. 3. Nombre las 4 etapas del agotamiento del cuidador. 4. ¿Qué es el paternalismo beneficente? 5. ¿Camuflar medicación es una práctica ética aceptada si el paciente tiene demencia? Convierte estas preguntas a formato opción múltiple con la respuesta correcta basada en el texto.";
      } else if (course.title.includes('Fase 2')) {
         customInstructions = "OBLIGATORIO: Tu examen DEBE estar basado en estas preguntas y los escenarios clínicos del material: 1. Calcule el estado anímico si en el GDS obtiene 11 puntos. 2. Mencione señales de alerta para detectar un posible Ictus. 3. ¿Por qué las UPP se consideran un fallo en la seguridad del paciente?. Completa hasta tener 5 preguntas.";
      } else if (course.title.includes('Fase 3')) {
         customInstructions = "OBLIGATORIO: Tu examen DEBE estar basado en estas preguntas: 1. ¿Cuál es el porcentaje de profesionales que detectan problemas éticos? 2. Defina Ludoterapia y su importancia en el envejecimiento activo. 3. Ante un conflicto sobre alimentación forzada, ¿qué órgano debe asesorar al equipo?. Completa hasta tener 5 preguntas de alto rigor clínico.";
      }

      prompt = `
Eres la Profesora Zendi, líder educativa de Zendity Academy.
Lee el siguiente material oficial (Master Material) y genera exactamente 5 preguntas de selección múltiple altamente rigurosas basadas estrictamente en la lectura.
Asegúrate de que haya solo 1 respuesta correcta obvia, y 3 distractores plausibles.

${customInstructions}
REGLAS DE CONTEXTO ESTRICTO DE ESTE CURSO ESPECÍFICO:
${courseContext}

OUTPUT OBLIGATORIO: Genera ÚNICAMENTE un JSON válido con esta estructura, sin bloques de markdown:
{
  "quiz": [
    {
      "question": "¿Pregunta de selección múltiple?",
      "options": ["Opcion A", "Opcion B", "Opcion C", "Opcion D"],
      "correctAnswer": "Opcion A",
      "explanation": "Breve explicación de por qué es la correcta (para el AI Coach)."
    }
  ]
}

MASTER MATERIAL:
${masterMaterial}
`;
    } else if (requestType === 'reflection') {
      const { userResponse } = body;
      prompt = `
Eres la Profesora Zendi, líder de ética clínica de Zendity Academy.
El alumno acaba de leer el MASTER MATERIAL y respondió a una "Dinámica de Reflexión".
Su respuesta fue: "${userResponse}"

TUS INSTRUCCIONES:
1. Evalúa si la respuesta del alumno es empática, profesional y respeta los principios biomédicos (Autonomía, Beneficencia, No Maleficencia, Justicia) aprendidos en la lectura.
2. Genera un feedback corto (2 párrafos máximo) constructivo y alentador.
3. Determina si la respuesta es "Aprobada" (apta profesionalmente) o "Rechazada" (peligrosa, antiética o irrelevante).

OUTPUT OBLIGATORIO: Genera ÚNICAMENTE este JSON:
{
  "approved": true/false,
  "feedback": "Tu evaluación escrita como Zendi AI..."
}

MASTER MATERIAL PARA REFERENCIA:
${masterMaterial}
`;
    } else {
      return NextResponse.json({ success: false, error: "Tipo de requerimiento inválido" }, { status: 400 });
    }

    // 3. Llamar a la API de Gemini usando el SDK Oficial
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("La integración de Zendity Academy está inactiva: Falta la GEMINI_API_KEY");
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const generatedText = result.response.text();

    // 4. Validar JSON y enviar al Frontend
    let cleanText = generatedText.trim();

    // Robust JSON extraction using regex to find content between { and } or [ and ]
    const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      cleanText = jsonMatch[1];
    } else {
      // Fallback: strip any leading/trailing non-json characters if markdown ticks were omitted
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }
    }

    const parsedJson = JSON.parse(cleanText.trim());

    return NextResponse.json({ success: true, data: parsedJson });
  } catch (error: any) {
    console.error("Zendity Academy AI Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
