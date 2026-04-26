import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado. Acceso exclusivo para familiares." }, { status: 401 });
        }

        // Recuperar al FamilyMember completo por su email (más robusto que depender de overrides en sesión)
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string }
        });

        if (!familyMember || !familyMember.patientId) {
            return NextResponse.json({ success: false, error: "Cuenta de familiar no vinculada a ningún residente activo." }, { status: 404 });
        }

        const resident = await prisma.patient.findUnique({
            where: { id: familyMember.patientId },
            include: {
                headquarters: true, // ¡Vital para el Branding Logo en la App Familiar!
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
        } catch(rawError) {
            console.error("Soft failing raw LifePlan query:", rawError);
        }

        // Solo mostrar vitales en rango normal al familiar — no alarmar con valores críticos.
        // El equipo clínico maneja los valores fuera de rango internamente (triage, alertas, eMAR).

        // Si temp > 50 está en °F (imposible en °C para un humano vivo) → convertir a °C
        function normalizeTemperature(temp: number): number {
            if (temp > 50) return (temp - 32) * 5 / 9;
            return temp;
        }

        function vitalsEnRangoNormal(v: { systolic: number; diastolic: number; temperature: number; heartRate: number; spo2: number | null } | null): boolean {
            if (!v) return false;
            if (v.systolic  < 90  || v.systolic  > 140) return false;
            if (v.diastolic < 60  || v.diastolic > 95)  return false; // 95 para adultos mayores
            if (v.spo2 != null && v.spo2 < 95)          return false;
            const tempC = normalizeTemperature(v.temperature);
            if (tempC < 36.0 || tempC > 37.5)           return false;
            if (v.heartRate < 60  || v.heartRate > 100) return false;
            return true;
        }

        // Fallback: si el vital más reciente falla el filtro, intentar con el siguiente
        const safeVitals = resident.vitalSigns.find(v => vitalsEnRangoNormal(v)) ?? null;

        // ── Sanitizar DailyLog antes de enviarlo al familiar ──────────────
        // 1. bathCompleted → BathLog (fuente de verdad)
        // 2. notas de alertas clínicas → null  (no alarmar sin contexto médico)
        // 3. isClinicalAlert → no enviar al cliente
        const ALERT_PREFIXES = ['[ALERTA', '[ACCIÓN PREVENTIVA', '[alerta'];
        const sanitizeNotes = (notes: string | null, isAlert: boolean): string | null => {
            if (!notes) return null;
            if (isAlert) return null;
            if (ALERT_PREFIXES.some(p => notes.startsWith(p))) return null;
            return notes;
        };

        const dailyLogsFixed = resident.dailyLogs.length > 0 ? (() => {
            const { isClinicalAlert, notes, ...rest } = resident.dailyLogs[0] as any;
            return [{
                ...rest,
                bathCompleted: !!bathToday,
                notes: sanitizeNotes(notes, !!isClinicalAlert),
            }];
        })() : [];

        return NextResponse.json({ success: true, resident: { ...resident, vitalSigns: safeVitals ? [safeVitals] : [], lifePlan, dailyLogs: dailyLogsFixed } });

    } catch (error: any) {
        console.error("Family Dashboard API Error:", error);
        return NextResponse.json({ success: false, error: "Error Server: " + (error?.message || "Desconocido") }, { status: 500 });
    }
}
