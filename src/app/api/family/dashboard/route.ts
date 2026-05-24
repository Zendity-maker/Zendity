import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import {
    resolveShareLevel,
    sanitizeClinical,
    isCleanNote,
    computeFoodBand,
} from '@/lib/family/disclosure';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado. Acceso exclusivo para familiares." }, { status: 401 });
        }

        // Recuperar al FamilyMember completo por su email
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string }
        });

        if (!familyMember || !familyMember.patientId) {
            return NextResponse.json({ success: false, error: "Cuenta de familiar no vinculada a ningún residente activo." }, { status: 404 });
        }

        const resident = await prisma.patient.findUnique({
            where: { id: familyMember.patientId },
            include: {
                headquarters: true, // Branding del logo
                vitalSigns: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                },
                dailyLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        foodIntake: true,
                        bathCompleted: true,
                        isClinicalAlert: true,
                        notes: true,
                        createdAt: true,
                    },
                },
                wellnessNotes: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: { author: { select: { name: true } } },
                },
                medications: {
                    include: {
                        medication: true
                    }
                },
                invoices: {
                    orderBy: { issueDate: 'desc' },
                    include: { items: true }
                }
            }
        });

        if (!resident) {
            return NextResponse.json({ success: false, error: "Residente no encontrado." }, { status: 404 });
        }

        // ── BathLog de hoy: fuente de verdad para higiene ─────────────────
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const bathToday = await prisma.bathLog.findFirst({
            where: {
                patientId: resident.id,
                timeLogged: { gte: todayStart },
            },
        });

        // Bypassing Prisma Client Schema Cache for LifePlan using Raw SQL Hotfix
        let lifePlan = null;
        try {
            const rawResults = await prisma.$queryRawUnsafe<any[]>(`SELECT id, status, "activeProtocols" FROM "LifePlan" WHERE "patientId" = $1 LIMIT 1`, familyMember.patientId);
            if (rawResults && rawResults.length > 0) {
                lifePlan = rawResults[0];
            }
        } catch (rawError) {
            console.error("Soft failing raw LifePlan query:", rawError);
        }

        // ── Sanitizar DailyLog (defensa de notas con prefijo de alerta) ──
        // El filtro de notes va SIEMPRE, independiente de shareLevel: una alerta
        // clínica nunca debe llegar a un familiar como nota cruda.
        const dailyLogsFixed = resident.dailyLogs.length > 0 ? (() => {
            const { isClinicalAlert, notes, ...rest } = resident.dailyLogs[0] as any;
            // isAlert: descarta si el flag explícito O el prefijo en texto lo marca como alerta.
            const safeNotes = isClinicalAlert ? null : (isCleanNote(notes) ? notes : null);
            return [{
                ...rest,
                bathCompleted: !!bathToday,
                notes: safeNotes,
            }];
        })() : [];

        // ── Sanitizar wellnessNotes (defensa contra alertas clínicas en feed) ──
        // Filtra notas con prefijos [ALERTA / [ACCIÓN PREVENTIVA / [alerta — esas
        // son señales internas del equipo, no narrativa para la familia.
        const cleanWellnessNotes = (resident.wellnessNotes || []).filter((n: any) =>
            isCleanNote(n.note)
        );

        // ── Gating por shareLevel ─────────────────────────────────────────
        // LIFESTYLE (default): cero números clínicos. Banda cualitativa SIEMPRE
        //   presente (sin vacío que la familia pueda "leer" como anomalía).
        // FULL (consentido): vista clínica completa, sin ocultar nada.
        const shareLevel = resolveShareLevel(resident as any);

        // medsOnTrack derivado de MedicationAdministration del día clínico actual.
        // Sin omisiones/missed/refused → true. Con alguna → false. Sin registros → null.
        // Mentir por default ("Al día" sin verificar) es peor que admitir "—".
        const clinicalDayStart = todayStartAST();
        const [totalToday, omitsToday] = await Promise.all([
            prisma.medicationAdministration.count({
                where: {
                    patientMedication: { patientId: resident.id },
                    scheduledTime: { gte: clinicalDayStart },
                },
            }),
            prisma.medicationAdministration.count({
                where: {
                    patientMedication: { patientId: resident.id },
                    scheduledTime: { gte: clinicalDayStart },
                    status: { in: ['OMITTED', 'MISSED', 'REFUSED'] },
                },
            }),
        ]);
        const medsOnTrack: boolean | null = totalToday === 0 ? null : omitsToday === 0;

        // foodBand cualitativo derivado del % de ingesta (no se expone el número en LIFESTYLE)
        const foodPct: number | null = (dailyLogsFixed[0] as any)?.foodIntake ?? null;
        const foodBand = computeFoodBand(foodPct);

        const wellness = {
            // Banda constante de reaseguro — nunca desaparece, no alarma.
            vitalsBand: 'Sus signos están estables y monitoreados por su equipo.',
            medsOnTrack,
            foodBand,
        };

        // Construye el resident con notes limpias + lifePlan + dailyLogs sanitizados
        const enrichedResident = {
            ...resident,
            wellnessNotes: cleanWellnessNotes,
            lifePlan,
            dailyLogs: dailyLogsFixed,
        };

        // Aplica gating clínico via helper centralizado.
        // FULL: regresa todo. LIFESTYLE: elimina medications, vitalSigns = [].
        const safeResident = sanitizeClinical(enrichedResident, shareLevel);

        return NextResponse.json({
            success: true,
            resident: { ...safeResident, shareLevel, wellness },
        });

    } catch (error: any) {
        console.error("Family Dashboard API Error:", error);
        return NextResponse.json({ success: false, error: "Error Server: " + (error?.message || "Desconocido") }, { status: 500 });
    }
}
