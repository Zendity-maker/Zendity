import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { prisma } from '@/lib/prisma';

export const maxDuration = 60; // Parche Staging Integral E2E

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
      if (course.title.includes('Certificación 1')) {
         customInstructions = "OBLIGATORIO: Tu examen DEBE evaluar la integración de datos y seguridad. Incluye: 1. La importancia de HIPAA en la confidencialidad de la información del paciente. 2. Qué rol juegan los modelos predictivos en el cuidado preventivo. 3. Cómo la visualización de datos ayuda a la administración clínica. Completa hasta 5 preguntas de opción múltiple.";
      } else if (course.title.includes('Certificación 2')) {
         customInstructions = "OBLIGATORIO: Tu examen DEBE evaluar el Liderazgo Transformador sobre el reactivo. Incluye: 1. La diferencia entre el lenguaje de un Supervisor-Jefe ('No hay nada que hacer') vs Supervisor-Líder ('Veremos qué podemos hacer'). 2. El propósito de Mindfulness bajo estrés. 3. Identificación del Burnout y cómo mitigarlo para proteger la seguridad del paciente. Completa hasta 5 preguntas.";
      } else if (course.title.includes('Certificación 3')) {
         customInstructions = "OBLIGATORIO: Tu examen DEBE evaluar la Metodología de Resolución. Incluye: 1. Los 5 criterios de la metodología MATER y su definición. 2. En qué consiste el Modelo del Reto (en lugar de enfocarse solo en los problemas). 3. Cómo identificar las causas mediante los Cinco Porqués o Espina de Pescado. Completa hasta 5 preguntas.";
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
      const { userResponse, promptZendi, terminosClave, preguntaReflexion } = body;

      // Use course-specific evaluation context if available, otherwise fallback to generic
      const evaluationCriteria = promptZendi
          ? `INSTRUCCIONES DE EVALUACION ESPECIFICAS DEL CURSO:\n${promptZendi}\n\nTERMINOS CLAVE que el alumno debe demostrar comprension de:\n${terminosClave}`
          : `Evalua si la respuesta demuestra mentalidad de Liderazgo Transformador, profesionalismo, y si incorpora herramientas sistemicas.`;

      const reflectionQ = preguntaReflexion
          ? `La pregunta de reflexion fue: "${preguntaReflexion}"`
          : `El alumno describio como aplicaria el conocimiento del curso en su trabajo.`;

      prompt = `
Eres la Profesora Zendi, lider educativa de Zendity Academy.
El alumno completo el curso "${course.title}" y respondio a una pregunta de reflexion.
${reflectionQ}

Su respuesta fue: "${userResponse}"

${evaluationCriteria}

TUS INSTRUCCIONES:
1. Evalua si la respuesta demuestra comprension profunda del material y aplica los conceptos clave del curso.
2. Genera un feedback corto (2 parrafos maximo) con criticas constructivas, felicitandolo si evidencia comprension real y aplicacion practica.
3. Determina si la respuesta es "Aprobada" (demuestra comprension real y aplicacion practica) o "Rechazada" (superficial, generica o incorrecta).

OUTPUT OBLIGATORIO: Genera UNICAMENTE este JSON:
{
  "approved": true/false,
  "feedback": "Tu evaluacion escrita como Zendi AI..."
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
