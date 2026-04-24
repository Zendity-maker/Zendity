import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];



export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });

        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: true, update: null });
        }

        const hqId = (session.user as any).headquartersId;
        const authorId = (session.user as any).id;
        const today = todayStartAST();

        // ── 1. Devolver update PENDING de hoy si ya existe ─────────────────
        const existing = await prisma.zendiNursingUpdate.findFirst({
            where: { authorId, headquartersId: hqId, status: 'PENDING', createdAt: { gte: today } },
            include: { patient: { select: { id: true, name: true, roomNumber: true } } }
        });

        if (existing) {
            return NextResponse.json({ success: true, update: existing });
        }

        // ── 2. Buscar residente calificado (round-robin por último update enviado) ─
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const weekStart   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Pacientes de esta sede con FamilyMember registrado
        // Tipamos como any[] para preservar las propiedades del include tras .filter()/.sort()
        const candidates: any[] = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                familyMembers: { some: { isRegistered: true } }
            },
            include: {
                vitalSigns: {
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                    where: { createdAt: { gte: threeDaysAgo } }
                },
                dailyLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 2
                },
                medications: {
                    where: { status: 'ACTIVE', isActive: true },
                    include: {
                        administrations: {
                            where: { administeredAt: { gte: weekStart } },
                            select: { status: true }
                        }
                    },
                    take: 10
                },
                pressureUlcers: {
                    where: { resolvedAt: null },
                    orderBy: { identifiedAt: 'desc' },
                    take: 1
                },
                zendiNursingUpdates: {
                    where: { status: 'SENT' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                }
            }
        });

        if (candidates.length === 0) {
            return NextResponse.json({ success: true, update: null });
        }

        // Filtrar: vitalSigns en últimos 3 días o meds con administraciones esta semana
        const qualified = candidates.filter(p =>
            p.vitalSigns.length > 0 ||
            p.medications.some((m: any) => m.administrations.length > 0)
        );

        if (qualified.length === 0) {
            return NextResponse.json({ success: true, update: null });
        }

        // Excluir residentes con SENT en últimos 7 días
        const eligible = qualified.filter(p => {
            const lastSent = p.zendiNursingUpdates[0]?.createdAt;
            return !lastSent || lastSent < sevenDaysAgo;
        });

        if (eligible.length === 0) {
            return NextResponse.json({ success: true, update: null });
        }

        // Round-robin: el que tiene el update más antiguo (o nunca tuvo)
        const sorted = [...eligible].sort((a, b) => {
            const aLast = a.zendiNursingUpdates[0]?.createdAt ?? null;
            const bLast = b.zendiNursingUpdates[0]?.createdAt ?? null;
            if (!aLast && !bLast) return a.id.localeCompare(b.id);
            if (!aLast) return -1;
            if (!bLast) return 1;
            return aLast.getTime() - bLast.getTime();
        });

        const patient = sorted[0];

        // ── 3. Construir contexto clínico real para el prompt ───────────────
        const vitals = patient.vitalSigns[0];
        const vitalsText = vitals
            ? `PA ${vitals.systolic}/${vitals.diastolic} mmHg, FC ${vitals.heartRate} bpm, Temp ${vitals.temperature}°C, SpO₂ ${vitals.spo2 ?? 'N/D'}%`
            : 'Sin vitales recientes en el sistema';

        const totalMeds = patient.medications.length;
        const administeredMeds = patient.medications.filter((m: any) =>
            m.administrations.some((a: any) => a.status === 'ADMINISTERED')
        ).length;
        const medsPercent = totalMeds > 0 ? Math.round((administeredMeds / totalMeds) * 100) : null;
        const medsText = medsPercent !== null
            ? `${medsPercent}% de los medicamentos administrados esta semana (${administeredMeds}/${totalMeds})`
            : 'Sin datos de medicación esta semana';

        const notesText = patient.dailyLogs
            .map((l: any) => l.notes?.trim())
            .filter(Boolean)
            .slice(0, 2)
            .join('. ') || 'Sin notas de turno recientes';

        const uppText = patient.pressureUlcers.length > 0
            ? `Úlcera bajo control y seguimiento activo del equipo de enfermería`
            : '';

        // ── 4. Generar con Gemini ────────────────────────────────────────────
        const prompt = `Eres Zendi, asistente clínico de Vivid Senior Living.
Genera 2 opciones de mensaje corto, cálido y positivo para que una enfermera envíe a la familia de ${patient.name}.

Datos clínicos reales de esta semana:
- Vitales: ${vitalsText}
- Medicamentos: ${medsText}
- Notas de turno: ${notesText}
${uppText ? `- Estado clínico: ${uppText}` : ''}

REGLAS IMPORTANTES:
- Siempre positivo y tranquilizador
- Incluir UN dato real específico de los datos anteriores
- Máximo 3 oraciones por opción
- Tono cálido, como una enfermera que conoce al residente de hace tiempo
- NO mencionar alertas, problemas ni datos preocupantes
- NO inventar datos que no estén arriba
- Dirigirse a "la familia" o "ustedes" de forma cercana
- En español

Responde SOLO en JSON sin markdown:
{ "optionGen1": "...", "optionGen2": "..." }`;

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(prompt);
        let rawText = (result.response.text() || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
        const aiOptions = JSON.parse(rawText);

        if (!aiOptions.optionGen1 || !aiOptions.optionGen2) {
            throw new Error("Gemini no retornó opciones válidas.");
        }

        // ── 5. Crear ZendiNursingUpdate PENDING ──────────────────────────────
        const newUpdate = await prisma.zendiNursingUpdate.create({
            data: {
                patientId: patient.id,
                authorId,
                headquartersId: hqId,
                status: 'PENDING',
                optionGen1: aiOptions.optionGen1,
                optionGen2: aiOptions.optionGen2
            },
            include: {
                patient: { select: { id: true, name: true, roomNumber: true } }
            }
        });

        return NextResponse.json({ success: true, update: newUpdate });

    } catch (error: any) {
        console.error('[nursing-updates GET] Error:', error);
        return NextResponse.json({ success: false, error: error?.message || "Error interno" }, { status: 500 });
    }
}
