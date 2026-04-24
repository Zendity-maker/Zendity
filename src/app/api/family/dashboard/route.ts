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
        function vitalsEnRangoNormal(v: { systolic: number; diastolic: number; temperature: number; heartRate: number; spo2: number | null } | null): boolean {
            if (!v) return false;
            if (v.systolic   < 90  || v.systolic   > 140) return false;
            if (v.diastolic  < 60  || v.diastolic  > 90)  return false;
            if (v.spo2  != null && v.spo2  < 95)          return false;
            if (v.temperature < 36.0 || v.temperature > 37.5) return false;
            if (v.heartRate  < 60  || v.heartRate   > 100) return false;
            return true;
        }

        const rawVitals = resident.vitalSigns[0] ?? null;
        const safeVitals = vitalsEnRangoNormal(rawVitals) ? rawVitals : null;

        return NextResponse.json({ success: true, resident: { ...resident, vitalSigns: safeVitals ? [safeVitals] : [], lifePlan } });

    } catch (error: any) {
        console.error("Family Dashboard API Error:", error);
        return NextResponse.json({ success: false, error: "Error Server: " + (error?.message || "Desconocido") }, { status: 500 });
    }
}
