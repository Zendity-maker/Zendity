import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const headquartersId = searchParams.get('hqId');

        if (!headquartersId) {
            return NextResponse.json({ success: false, error: "Headquarters ID Required" }, { status: 400 });
        }

        const todayStart = todayStartAST();

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // 0. Fetch Headquarters Info
        const hqInfo = await prisma.headquarters.findUnique({
            where: { id: headquartersId },
            select: { name: true, logoUrl: true }
        });

        // 1. Fetch All Active Patients (Room Map Data)
        const activePatients = await prisma.patient.findMany({
            where: {
                headquartersId,
                status: 'ACTIVE'
            },
            select: {
                id: true,
                name: true,
                roomNumber: true,
                colorGroup: true,
                photoUrl: true,
            },
            orderBy: { roomNumber: 'asc' }
        });

        // 2. Fetch Today's Medication Logs
        const medsAdministeredToday = await prisma.medicationAdministration.count({
            where: {
                status: 'ADMINISTERED',
                administeredAt: {
                    gte: todayStart,
                    lte: todayEnd
                },
                patientMedication: {
                    patient: {
                        headquartersId
                    }
                }
            }
        });

        // 3. Fetch Active Clinical Alerts / Incidents
        const activeIncidents = await prisma.complaint.count({
            where: {
                headquartersId,
                status: {
                    in: ['PENDING', 'ROUTED_NURSING']
                }
            }
        });

        const activeUlcers = await prisma.pressureUlcer.count({
            where: {
                status: 'ACTIVE',
                patient: { headquartersId }
            }
        });

        // 4. Fetch Today's Kitchen Menu
        const todayMenu = await prisma.dailyMenu.findFirst({
            where: {
                headquartersId,
                date: {
                    gte: todayStart,
                    lte: todayEnd
                }
            }
        });

        const fallbackMenu = { breakfast: 'Avena y Frutas', lunch: 'Sopa de Pollo y Arroz', dinner: 'Pescado al Horno', snacks: 'Yogurt' };

        // 5. Fetch Top 5 Staff for Leaderboard (Phase 29)
        const leaderboard = await prisma.user.findMany({
            where: {
                headquartersId,
                role: { in: ['CAREGIVER', 'NURSE'] }
            },
            orderBy: { complianceScore: 'desc' },
            take: 5,
            select: { id: true, name: true, role: true, complianceScore: true, photoUrl: true }
        });

        return NextResponse.json({
            success: true,
            data: {
                hqInfo: {
                    name: hqInfo?.name || "Vivid Senior Living",
                    logoUrl: hqInfo?.logoUrl || null
                },
                patients: activePatients,
                stats: {
                    totalActivePatients: activePatients.length,
                    medsAdministeredToday,
                    activeAlerts: activeIncidents + activeUlcers
                },
                menu: {
                    breakfast: todayMenu?.breakfast || fallbackMenu.breakfast,
                    lunch: todayMenu?.lunch || fallbackMenu.lunch,
                    dinner: todayMenu?.dinner || fallbackMenu.dinner,
                    snacks: todayMenu?.snacks || fallbackMenu.snacks
                },
                leaderboard
            }
        });

    } catch (error) {
        console.error("WALL OF CARE AGGREGATION Error:", error);
        return NextResponse.json({ success: false, error: "Fallo en la sincronización del Wall of Care" }, { status: 500 });
    }
}
