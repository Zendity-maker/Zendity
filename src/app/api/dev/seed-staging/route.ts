import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role, ColorGroup } from '@prisma/client';

export const maxDuration = 60; // Prolongar tiempo para la ejecución masiva

export async function GET(req: Request) {
    try {
        console.log(`[🚀] Ejecutando Staging E2E Seed vía API...`);

        // --- 1. CREACIÓN DE SEDES ---
        const hqs = ['Vivid Senior Living Cupey', 'Vivid Guaynabo Elite', 'Vivid Dorado Resort'];
        const createdHqs = [];
        for (const name of hqs) {
            let hq = await prisma.headquarters.findFirst({ where: { name } });
            if (!hq) hq = await prisma.headquarters.create({ data: { name, licenseActive: true, licenseExpiry: new Date('2028-12-31') } });
            createdHqs.push(hq);
        }
        const cupeyId = createdHqs[0].id;

        // --- 2. ROLES ---
        const usersData = [
            { email: 'director@vivid.com', name: 'Andrés Flores (Director General)', role: Role.ADMIN },
            { email: 'sup.cupey@vivid.com', name: 'Carmen (Supervisora Cupey)', role: Role.NURSE },
            { email: 'sup.guaynabo@vivid.com', name: 'Roberto (Supervisor Guaynabo)', role: Role.NURSE },
            { email: 'sup.dorado@vivid.com', name: 'Lucía (Supervisora Dorado)', role: Role.NURSE },
            { email: 'c1@vivid.com', name: 'Pedro (Cuidador Cupey A)', role: Role.CAREGIVER },
            { email: 'c2@vivid.com', name: 'María (Cuidador Cupey B)', role: Role.CAREGIVER },
        ];

        for (const u of usersData) {
            await prisma.user.upsert({
                where: { email: u.email },
                update: { pinCode: '1234' },
                create: { email: u.email, name: u.name, pinCode: '1234', role: u.role, headquartersId: cupeyId }
            });
        }
        const pedro = await prisma.user.findFirst({ where: { email: 'c1@vivid.com' } });

        // --- 3. PACIENTES ---
        const patientNames = [
            'Doña Rosa', 'Don Julio', 'María Antonieta', 'Miguel Rivera', 'Carmen Solís', 
            'Roberto Martínez', 'Ana Luisa', 'Juana Cruz', 'Víctor Hugo', 'Luz Esther', 
            'Francisco Pérez', 'Teresa Colón', 'Jorge Luis', 'Ángel Vega', 'Héctor Pagán'
        ];
        const patients = [];
        for (const [i, name] of patientNames.entries()) {
            let p = await prisma.patient.findFirst({ where: { name, headquartersId: cupeyId }});
            if (!p) {
                p = await prisma.patient.create({
                    data: {
                        name,
                        headquartersId: cupeyId,
                        roomNumber: `A-${100 + i}`,
                        colorGroup: i % 3 === 0 ? ColorGroup.RED : (i % 2 === 0 ? ColorGroup.YELLOW : ColorGroup.GREEN),
                        diet: i % 2 === 0 ? 'Regular' : 'Diabética',
                        downtonRisk: i % 2 === 0,
                    }
                });
            }
            patients.push(p);
        }

        // --- 4. ZOMBIFICACIÓN: Logs Viejos ---
        if (pedro && patients.length > 0) {
            const zomb = await prisma.dailyLog.findFirst({ where: { authorId: pedro.id, notes: { contains: "ZOMBIE_LOG" } } });
            if (!zomb) {
                await prisma.dailyLog.create({
                    data: {
                        patientId: patients[0].id,
                        authorId: pedro.id,
                        notes: "ZOMBIE_LOG: Prueba de sesión abierta por más de 12 horas.",
                        foodIntake: 100,
                        createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000)
                    }
                });
            }
        }

        // --- 5. CALENDARIO: Eventos Inyectados ---
        const eventTypes = ["FACILITY_ROUTINE", "MEDICAL_APPOINTMENT", "FACILITY_ROUTINE", "THERAPY", "FACILITY_ROUTINE"];
        for (let i = 0; i < 5; i++) {
            const evtTitle = `Actividad Programada API ${i + 1}`;
            const existingEvt = await prisma.calendarEvent.findFirst({ where: { title: evtTitle, headquartersId: cupeyId }});
            if (!existingEvt) {
                await prisma.calendarEvent.create({
                    data: {
                        headquartersId: cupeyId,
                        patientId: patients[i].id,
                        assignedToId: i % 2 === 0 && pedro ? pedro.id : null,
                        type: eventTypes[i] as any,
                        status: "SCHEDULED",
                        title: evtTitle,
                        description: "Generado dinámicamente vía API - Seed de Staging",
                        originContext: "API_SEED_SCRIPT",
                        startTime: new Date(Date.now() + i * 60 * 60 * 1000),
                    }
                });
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: "¡Semilla de Staging Integral Inyectada Correctamente!",
            data: {
                hqs: createdHqs.length,
                patientsInjected: patients.length,
                eventsCreated: 5
            }
        });

    } catch (error: any) {
        console.error("Seed API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
