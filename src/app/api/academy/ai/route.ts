import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestType } = body; // 'flashcards' o 'quiz'

    // 1. Leer Master Material Básico (Se alimentará de base de datos en el futuro)
    const masterMaterialPath = path.join(process.cwd(), 'src/data/academy_master_material.txt');

    let masterMaterial = "No master material found";
    try {
      masterMaterial = fs.readFileSync(masterMaterialPath, 'utf8');
    } catch (e) {
      console.warn("Could not read master material from cwd. Trying __dirname fallback.", e);
      try {
        const fallbackPath = path.join(__dirname, '../../../../src/data/academy_master_material.txt');
        masterMaterial = fs.readFileSync(fallbackPath, 'utf8');
      } catch (e2) {
        console.error("Failed to load master material completely.", e2);
      }
    }

    // Inyectar un poco de contexto dinámico para que Gemini varíe el contenido según el curso clickeado
    let courseContext = "";
    if (body.courseId) {
      if (body.courseId === 'cls2') {
        courseContext = "ENFOQUE PRINCIPAL: Este es el Curso 2: Manual de Cuidadores. Debes enfocarte exclusivamente en técnicas de cuidado diario, empatía, alimentación asistida y manejo de higiene. NO hables de prevención de caídas.";
      } else if (body.courseId === 'cls3') {
        courseContext = "ENFOQUE PRINCIPAL: Este es el Curso 3: Guía del Director Administrativo. Debes enfocarte en gestión de personal (RRHH), control de calidad, presupuestos y atención a quejas de familiares. NO hables de temas clínicos directos.";
      } else if (body.courseId === 'cls4') {
        courseContext = "ENFOQUE PRINCIPAL: Este es el Curso 4: Control de Medicación (eMAR). Debes enfocarte en la regla de los 5 correctos, registro en la tablet, diferencias entre PRN y medicamentos fijos, y prevención de errores de dispensación.";
      } else if (body.courseId === 'cls5') {
        courseContext = "ENFOQUE PRINCIPAL: Este es el Curso 5: Protocolos de Mantenimiento y Planta Física. Debes enfocarte en el uso del SLA, reparación de averías comunes, limpieza de filtros HVAC, y control de suministros.";
      } else {
        courseContext = "ENFOQUE PRINCIPAL: Este es el Curso Base de Prevención de Caídas y protocolos generales de baño. Enfócate en seguridad del paciente, transferencias y evaluación de riesgos.";
      }
    }


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
      prompt = `
Eres la Profesora Zendi, líder educativa de Zendity Academy.
Lee el siguiente material oficial (Master Material) y genera exactamente 5 preguntas de selección múltiple altamente rigurosas basadas estrictamente en la lectura.
Asegúrate de que haya solo 1 respuesta correcta obvia, y 3 distractores plausibles.

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
    } else {
      return NextResponse.json({ success: false, error: "Tipo de requerimiento inválido" }, { status: 400 });
    }

    // 3. Llamar a la API de Gemini usando el SDK Oficial
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("La integración de Zendity Academy está inactiva: Falta la GEMINI_API_KEY");
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
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
