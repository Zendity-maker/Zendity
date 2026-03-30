import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role, ColorGroup } from '@prisma/client';

export const maxDuration = 60;

// ⚠️  PROTECCIÓN: Este seed SIEMPRE usará la Sede de Prueba (Sandbox).
// NUNCA inyecta data en sedes reales como Vivid Cupey.
const SANDBOX_HQ_NAME = 'Sede de Prueba (Sandbox)';

export async function GET(req: Request) {
    try {
        console.log(`[🚀] Ejecutando Staging E2E Seed en SANDBOX (jamás en producción)...`);

        // --- 1. SEDE DE PRUEBA (Sandbox) ---
        let sandboxHq = await prisma.headquarters.findFirst({ where: { name: SANDBOX_HQ_NAME } });
        if (!sandboxHq) {
            sandboxHq = await prisma.headquarters.create({
                data: {
                    name: SANDBOX_HQ_NAME,
                    licenseActive: true,
                    licenseExpiry: new Date('2099-12-31'),
                    logoUrl: '/brand/zendity_logo_primary.svg',
                }
            });
        }
        const sandboxId = sandboxHq.id;
        console.log(`[✅] Usando Sede de Prueba: ${sandboxHq.name} (${sandboxId})`);

        // --- 2. USUARIOS SANDBOX ---
        const usersData = [
            { email: 'admin@sandbox.dev', name: 'Admin Sandbox', role: Role.ADMIN },
            { email: 'sup@sandbox.dev', name: 'Supervisora Sandbox', role: Role.NURSE },
            { email: 'c1@sandbox.dev', name: 'Cuidador A (Sandbox)', role: Role.CAREGIVER },
            { email: 'c2@sandbox.dev', name: 'Cuidador B (Sandbox)', role: Role.CAREGIVER },
        ];

        for (const u of usersData) {
            await prisma.user.upsert({
                where: { email: u.email },
                update: { pinCode: '0000', headquartersId: sandboxId },
                create: { email: u.email, name: u.name, pinCode: '0000', role: u.role, headquartersId: sandboxId }
            });
        }

        const sandboxAdmin = await prisma.user.findFirst({ where: { email: 'c1@sandbox.dev' } });

        // --- 3. PACIENTES SANDBOX ---
        const patientNames = [
            'Paciente Alpha (Test)', 'Paciente Beta (Test)', 'Paciente Gamma (Test)',
            'Paciente Delta (Test)', 'Paciente Epsilon (Test)',
        ];
        const patients = [];
        for (const [i, name] of patientNames.entries()) {
            let p = await prisma.patient.findFirst({ where: { name, headquartersId: sandboxId } });
            if (!p) {
                p = await prisma.patient.create({
                    data: {
                        name,
                        headquartersId: sandboxId,
                        roomNumber: `S-${100 + i}`,
                        colorGroup: i % 3 === 0 ? ColorGroup.RED : (i % 2 === 0 ? ColorGroup.YELLOW : ColorGroup.GREEN),
                        diet: i % 2 === 0 ? 'Regular' : 'Diabética',
                        downtonRisk: i % 2 === 0,
                    }
                });
            }
            patients.push(p);
        }

        // --- 4. TRIAGE TICKETS SANDBOX ---
        for (let i = 0; i < 2; i++) {
            const existing = await prisma.triageTicket.findFirst({
                where: { headquartersId: sandboxId, patientId: patients[i].id }
            });
            if (!existing) {
                await prisma.triageTicket.create({
                    data: {
                        headquartersId: sandboxId,
                        patientId: patients[i].id,
                        priority: i === 0 ? 'HIGH' : 'MEDIUM' as any,
                        originType: 'MANUAL' as any,
                        description: `[SANDBOX TEST] Ticket de prueba #${i + 1} — No es data real.`,
                        status: 'OPEN',
                    }
                });
            }
        }

        // --- 5. CALENDAR EVENTS SANDBOX ---
        for (let i = 0; i < 3; i++) {
            const evtTitle = `[Sandbox] Evento de Prueba ${i + 1}`;
            const existingEvt = await prisma.calendarEvent.findFirst({ where: { title: evtTitle, headquartersId: sandboxId } });
            if (!existingEvt) {
                await prisma.calendarEvent.create({
                    data: {
                        headquartersId: sandboxId,
                        patientId: patients[i].id,
                        assignedToId: i % 2 === 0 && sandboxAdmin ? sandboxAdmin.id : null,
                        type: 'FACILITY_ROUTINE' as any,
                        status: 'SCHEDULED',
                        title: evtTitle,
                        description: 'Generado por seed de staging (Sandbox)',
                        originContext: 'API_SEED_SCRIPT',
                        startTime: new Date(Date.now() + i * 60 * 60 * 1000),
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: '✅ Seed de Sandbox ejecutado. No se afectaron sedes reales.',
            data: {
                hq: SANDBOX_HQ_NAME,
                hqId: sandboxId,
                patientsInjected: patients.length,
                usersCreated: usersData.length,
            }
        });

    } catch (error: any) {
        console.error('Seed Sandbox API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
