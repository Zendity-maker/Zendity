/**
 * prisma/seeds/sandbox-caregiver.ts
 * Seed de datos FICTICIOS para el sandbox HQ.
 * Crea: 1 cuidadora demo, 4 residentes ficticios, schedule publicado,
 *       medicamentos eMAR, vitals pendientes, daily logs y handover previo.
 *
 * NUNCA toca datos del HQ de producción Cupey.
 * Uso: npx tsx prisma/seeds/sandbox-caregiver.ts
 */

import { prisma } from '../../src/lib/prisma';
import bcrypt from 'bcryptjs';

const SANDBOX_HQ = 'b2ac0700-f937-4085-9595-dcf81a2e5e30';

// Hora AST actual (Puerto Rico, UTC-4)
function nowAST(): Date { return new Date(); }
function todayAtHour(h: number): Date {
    const d = new Date();
    d.setUTCHours(h + 4, 0, 0, 0); // UTC+4 → AST hour h
    return d;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  SANDBOX SEED — datos ficticios para Manual Cuidador     ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`HQ: ${SANDBOX_HQ}\n`);

    // ── 1. Verificar HQ existe ────────────────────────────────────────────
    const hq = await prisma.headquarters.findUnique({ where: { id: SANDBOX_HQ } });
    if (!hq) throw new Error(`HQ ${SANDBOX_HQ} no encontrado en la DB`);
    console.log(`✅ HQ: ${hq.name}`);

    // ── 2. Cuidadora demo ─────────────────────────────────────────────────
    const pinHash = await bcrypt.hash('1234', 10);

    const caregiver = await prisma.user.upsert({
        where: { email: 'ana.demo@sandbox.zendity.com' },
        update: { pinCode: pinHash },
        create: {
            headquartersId: SANDBOX_HQ,
            name: 'Ana Demo',
            email: 'ana.demo@sandbox.zendity.com',
            pinCode: pinHash,
            role: 'CAREGIVER',
        },
    });
    console.log(`✅ Cuidadora: ${caregiver.name} (${caregiver.email}) PIN:1234`);

    // Supervisor ficticio para vitals orders y handover
    const supervisor = await prisma.user.upsert({
        where: { email: 'super.demo@sandbox.zendity.com' },
        update: {},
        create: {
            headquartersId: SANDBOX_HQ,
            name: 'Carlos Supervisor Demo',
            email: 'super.demo@sandbox.zendity.com',
            pinCode: pinHash,
            role: 'SUPERVISOR',
        },
    });
    console.log(`✅ Supervisor: ${supervisor.name}`);

    // ── 3. Residentes ficticios (color GREEN — mismo que Ana Demo) ────────
    const RESIDENTS = [
        { name: 'María Test',    room: '101', color: 'GREEN' as const, dob: new Date('1942-03-15') },
        { name: 'Carlos Demo',   room: '102', color: 'GREEN' as const, dob: new Date('1938-07-22') },
        { name: 'Rosa Sandbox',  room: '103', color: 'GREEN' as const, dob: new Date('1945-11-08') },
        { name: 'Pedro Ficticio',room: '104', color: 'RED'   as const, dob: new Date('1935-01-30') },
    ];

    const patients = [];
    for (const r of RESIDENTS) {
        // Upsert by name+hq (no unique constraint, use findFirst+upsert workaround)
        let patient = await prisma.patient.findFirst({
            where: { headquartersId: SANDBOX_HQ, name: r.name },
        });
        if (!patient) {
            patient = await prisma.patient.create({
                data: {
                    headquartersId: SANDBOX_HQ,
                    name: r.name,
                    roomNumber: r.room,
                    dateOfBirth: r.dob,
                    colorGroup: r.color,
                    status: 'ACTIVE',
                    diet: 'Regular',
                },
            });
            console.log(`  ✅ Creado residente: ${patient.name} (${r.color}, Hab. ${r.room})`);
        } else {
            await prisma.patient.update({
                where: { id: patient.id },
                data: { colorGroup: r.color, roomNumber: r.room, status: 'ACTIVE' },
            });
            console.log(`  ♻️  Ya existe: ${patient.name}`);
        }
        patients.push(patient);
    }

    // ── 4. Schedule PUBLISHED para la semana actual ───────────────────────
    // weekStartDate = lunes de esta semana
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);

    let schedule = await prisma.schedule.findFirst({
        where: { headquartersId: SANDBOX_HQ, weekStartDate: monday },
    });
    if (!schedule) {
        schedule = await prisma.schedule.create({
            data: {
                headquartersId: SANDBOX_HQ,
                weekStartDate: monday,
                status: 'PUBLISHED',
                publishedAt: new Date(),
                createdByUserId: supervisor.id,
            },
        });
    } else {
        schedule = await prisma.schedule.update({
            where: { id: schedule.id },
            data: { status: 'PUBLISHED', publishedAt: new Date() },
        });
    }
    console.log(`✅ Schedule PUBLISHED id=${schedule.id.slice(0, 8)}…`);

    // Shift del día actual (MORNING si es antes de 2PM AST, EVENING si es 2-10PM, NIGHT si es 10PM-6AM)
    const astHour = parseInt(new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico',
    }).format(new Date()), 10) % 24;
    const currentShift = astHour >= 6 && astHour < 14 ? 'MORNING'
        : astHour >= 14 && astHour < 22 ? 'EVENING' : 'NIGHT';
    console.log(`  Turno actual: ${currentShift} (${astHour}h AST)`);

    // Upsert ScheduledShift para hoy
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);

    let shift = await prisma.scheduledShift.findFirst({
        where: { scheduleId: schedule.id, userId: caregiver.id, date: todayDate },
    });
    if (!shift) {
        shift = await prisma.scheduledShift.create({
            data: {
                scheduleId: schedule.id,
                userId: caregiver.id,
                date: todayDate,
                shiftType: currentShift as any,
                colorGroup: 'GREEN',
            },
        });
        console.log(`✅ ScheduledShift: ${caregiver.name} / GREEN / ${currentShift}`);
    } else {
        await prisma.scheduledShift.update({
            where: { id: shift.id },
            data: { colorGroup: 'GREEN', shiftType: currentShift as any },
        });
        console.log(`♻️  ScheduledShift ya existe`);
    }

    // ShiftColorAssignment para Ana Demo → GREEN
    const existing = await prisma.shiftColorAssignment.findFirst({
        where: { scheduledShiftId: shift.id, userId: caregiver.id, color: 'GREEN' },
    });
    if (!existing) {
        await prisma.shiftColorAssignment.create({
            data: {
                headquartersId: SANDBOX_HQ,
                scheduledShiftId: shift.id,
                userId: caregiver.id,
                color: 'GREEN',
                isAutoAssigned: true,
            },
        });
        console.log(`✅ ShiftColorAssignment GREEN → Ana Demo`);
    }

    // ShiftSession activa para Ana Demo
    let session = await prisma.shiftSession.findFirst({
        where: { headquartersId: SANDBOX_HQ, caregiverId: caregiver.id, actualEndTime: null },
    });
    if (!session) {
        const shiftStart = new Date();
        shiftStart.setMinutes(0, 0, 0);
        shiftStart.setHours(shiftStart.getHours() - 1); // inicio hace 1h
        session = await prisma.shiftSession.create({
            data: {
                headquartersId: SANDBOX_HQ,
                caregiverId: caregiver.id,
                startTime: shiftStart,
            },
        });
        console.log(`✅ ShiftSession activa creada`);
    } else {
        console.log(`♻️  ShiftSession activa ya existe`);
    }

    // ── 5. Medicamentos eMAR ──────────────────────────────────────────────
    // Slot horario actual para que aparezcan PENDIENTES
    const slotHour = astHour < 12 ? '08:00 AM' : astHour < 18 ? '12:00 PM' : '06:00 PM';

    const MED_CATALOG = [
        { name: 'Losartán',    dosage: '50mg',  category: 'Antihipertensivos' },
        { name: 'Metformina',  dosage: '500mg', category: 'Antidiabéticos' },
        { name: 'Atorvastatina', dosage: '40mg', category: 'Hipolipemiantes' },
    ];

    // Solo para residentes GREEN (los de Ana Demo)
    const greenPatients = patients.filter(p => RESIDENTS.find(r => r.name === p.name)?.color === 'GREEN');

    for (const patient of greenPatients.slice(0, 3)) {
        for (const medData of MED_CATALOG.slice(0, 2)) {
            // Global medication (sin hqId = master)
            let med = await prisma.medication.findFirst({ where: { name: medData.name } });
            if (!med) {
                med = await prisma.medication.create({
                    data: { name: medData.name, dosage: medData.dosage, category: medData.category, isGlobalMaster: true },
                });
            }

            // PatientMedication
            let pm = await prisma.patientMedication.findFirst({
                where: { patientId: patient.id, medicationId: med.id, isActive: true },
            });
            if (!pm) {
                pm = await prisma.patientMedication.create({
                    data: {
                        patientId: patient.id,
                        medicationId: med.id,
                        frequency: 'DIARIO',
                        scheduleTimes: JSON.stringify(['08:00 AM', '06:00 PM']),
                        instructions: 'Administrar con alimentos.',
                        isActive: true,
                    },
                });
            }

            // MedicationAdministration PENDING para el slot actual
            const scheduledTime = new Date();
            scheduledTime.setMinutes(0, 0, 0);
            if (slotHour === '08:00 AM') scheduledTime.setHours(8);
            else if (slotHour === '12:00 PM') scheduledTime.setHours(12);
            else scheduledTime.setHours(18);

            const exists = await prisma.medicationAdministration.findFirst({
                where: { patientMedicationId: pm.id, scheduledTime, status: 'PENDING' },
            });
            if (!exists) {
                await prisma.medicationAdministration.create({
                    data: {
                        patientMedicationId: pm.id,
                        administeredById: caregiver.id,
                        scheduledTime,
                        scheduleTime: slotHour,
                        status: 'PENDING',
                    },
                });
            }
        }
    }
    console.log(`✅ eMAR: medicamentos PENDING para slot ${slotHour}`);

    // ── 6. VitalsOrders PENDING ───────────────────────────────────────────
    const vitalsExpiry = new Date();
    vitalsExpiry.setHours(vitalsExpiry.getHours() + 3); // expiran en 3h (simula urgencia)

    for (const patient of greenPatients.slice(0, 2)) {
        const existingOrder = await prisma.vitalsOrder.findFirst({
            where: { patientId: patient.id, status: 'PENDING' },
        });
        if (!existingOrder) {
            await prisma.vitalsOrder.create({
                data: {
                    headquartersId: SANDBOX_HQ,
                    patientId: patient.id,
                    orderedById: supervisor.id,
                    caregiverId: caregiver.id,
                    reason: 'Toma rutinaria de inicio de turno',
                    expiresAt: vitalsExpiry,
                    status: 'PENDING',
                    autoCreated: true,
                    shiftSessionId: session.id,
                },
            });
        }
    }
    console.log(`✅ VitalsOrders: 2 PENDING (expiran en ~3h)`);

    // Un vital reciente completado para referencia
    const existingVitals = await prisma.vitalSigns.findFirst({
        where: { patientId: greenPatients[0].id, measuredById: caregiver.id },
    });
    if (!existingVitals) {
        await prisma.vitalSigns.create({
            data: {
                patientId: greenPatients[0].id,
                measuredById: caregiver.id,
                systolic: 118, diastolic: 76,
                temperature: 37.1, heartRate: 72,
                glucose: 102, spo2: 97,
            },
        });
        console.log(`✅ VitalSigns de referencia creado para ${greenPatients[0].name}`);
    }

    // ── 7. DailyLog / Observación ─────────────────────────────────────────
    const existingLog = await prisma.dailyLog.findFirst({
        where: { patientId: greenPatients[1].id, authorId: caregiver.id },
    });
    if (!existingLog) {
        await prisma.dailyLog.create({
            data: {
                patientId: greenPatients[1].id,
                authorId: caregiver.id,
                bathCompleted: true,
                foodIntake: 75,
                notes: 'Residente con buen ánimo. Refirió leve malestar estomacal antes del desayuno, sin síntomas posteriores. Se mantuvo alerta durante actividades.',
                isClinicalAlert: false,
                isResolved: false,
            },
        });
        console.log(`✅ DailyLog creado para ${greenPatients[1].name}`);
    }

    // ── 8. ShiftHandover del turno ANTERIOR (para que cierre tenga data) ─
    const prevShift = currentShift === 'MORNING' ? 'NIGHT'
        : currentShift === 'EVENING' ? 'MORNING' : 'EVENING';

    const existingHandover = await prisma.shiftHandover.findFirst({
        where: { headquartersId: SANDBOX_HQ, shiftType: prevShift as any },
        orderBy: { createdAt: 'desc' },
    });
    if (!existingHandover) {
        const prevHandover = await prisma.shiftHandover.create({
            data: {
                headquartersId: SANDBOX_HQ,
                shiftType: prevShift as any,
                outgoingNurseId: caregiver.id,
                status: 'ACCEPTED',
                handoverCompleted: true,
                colorGroups: ['GREEN'],
                isDailyPrologue: false,
                signedOutAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
                aiSummaryReport: `RESUMEN TURNO ${prevShift} — Sede de Prueba (Sandbox)

El turno transcurrió sin incidentes mayores. Todos los residentes del grupo VERDE fueron atendidos conforme al plan de cuidado.

MEDICAMENTOS: 100% de administración completada. Sin omisiones ni rechazos.

VITALES: Tomados dentro de las primeras 4 horas del turno. María Test presentó presión arterial en 118/76, dentro del rango normal. Carlos Demo con frecuencia cardíaca de 72 bpm.

OBSERVACIONES: Rosa Sandbox refirió leve malestar estomacal que cedió sin intervención. Se documentó para seguimiento.

PENDIENTE PARA EL TURNO ENTRANTE: Administrar medicación de las ${slotHour} para los tres residentes del grupo VERDE.`,
            },
        });

        // HandoverNotes individuales
        for (const patient of greenPatients.slice(0, 2)) {
            await prisma.handoverNote.create({
                data: {
                    shiftHandoverId: prevHandover.id,
                    patientId: patient.id,
                    clinicalNotes: patient.name === greenPatients[0].name
                        ? 'Presión arterial estable. Descansó bien durante el turno. Sin novedades.'
                        : 'Refirió leve malestar estomacal antes del desayuno. Sin fiebre ni otros síntomas. Se recomienda monitorear ingesta.',
                    isCritical: false,
                },
            });
        }
        console.log(`✅ ShiftHandover del turno ${prevShift} anterior creado con AI summary`);
    } else {
        console.log(`♻️  ShiftHandover previo ya existe`);
    }

    // ── Resumen ───────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('SEED COMPLETADO — Datos ficticios para Manual Cuidador');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`Cuidadora:    Ana Demo <ana.demo@sandbox.zendity.com> PIN:1234`);
    console.log(`Supervisor:   Carlos Supervisor Demo`);
    console.log(`Residentes:   ${patients.length} (3 GREEN + 1 RED)`);
    console.log(`Schedule:     PUBLISHED — semana del ${monday.toLocaleDateString('es-PR')}`);
    console.log(`Turno actual: ${currentShift} / Slot eMAR: ${slotHour}`);
    console.log(`eMAR:         PENDING para María Test, Carlos Demo, Rosa Sandbox`);
    console.log(`VitalsOrders: 2 PENDING`);
    console.log(`Handover:     ${prevShift} anterior completado con AI summary`);
    console.log('══════════════════════════════════════════════════════════\n');
}

main()
    .catch(e => { console.error('FATAL:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
