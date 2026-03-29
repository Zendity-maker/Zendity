import { PrismaClient, Role, ColorGroup, MedStatus, MedActiveStatus } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
    console.log(`[🚀] Iniciando Staging E2E Seed...`);

    // --- 1. SEDES ---
    const hqs = ['Vivid Senior Living Cupey', 'Vivid Guaynabo Elite', 'Vivid Dorado Resort'];
    const createdHqs = [];
    for (const name of hqs) {
        let hq = await prisma.headquarters.findFirst({ where: { name } });
        if (!hq) hq = await prisma.headquarters.create({ data: { name, licenseActive: true, licenseExpiry: new Date('2028-12-31') } });
        createdHqs.push(hq);
    }
    const cupeyId = createdHqs[0].id;
    console.log(`[✅] Sedes creadas.`);

    // --- 2. USUARIOS ---
    const usersData = [
        { email: 'director@vivid.com', name: 'Andrés Flores (Director General)', role: Role.ADMIN },
        { email: 'sup.cupey@vivid.com', name: 'Carmen (Supervisora Cupey)', role: Role.NURSE },
        { email: 'sup.guaynabo@vivid.com', name: 'Roberto (Supervisor Guaynabo)', role: Role.NURSE },
        { email: 'sup.dorado@vivid.com', name: 'Lucía (Supervisora Dorado)', role: Role.NURSE },
        { email: 'c1@vivid.com', name: 'Pedro (Cuidador Cupey A)', role: Role.CAREGIVER },
        { email: 'c2@vivid.com', name: 'María (Cuidador Cupey B)', role: Role.CAREGIVER },
        { email: 'c3@vivid.com', name: 'José (Cuidador Cupey C)', role: Role.CAREGIVER },
        { email: 'c4@vivid.com', name: 'Laura (Cuidador Cupey D)', role: Role.CAREGIVER },
    ];
    for (const u of usersData) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: { pinCode: '1234' },
            create: { email: u.email, name: u.name, pinCode: '1234', role: u.role, headquartersId: cupeyId }
        });
    }
    const pedro = await prisma.user.findFirst({ where: { email: 'c1@vivid.com' } });
    const maria = await prisma.user.findFirst({ where: { email: 'c2@vivid.com' } });
    const jose = await prisma.user.findFirst({ where: { email: 'c3@vivid.com' } });
    const laura = await prisma.user.findFirst({ where: { email: 'c4@vivid.com' } });
    const carmen = await prisma.user.findFirst({ where: { email: 'sup.cupey@vivid.com' } });
    console.log(`[✅] Equipo operativo creado.`);

    // --- 3. PACIENTES ---
    const patientNames = [
        'Doña Rosa', 'Don Julio', 'María Antonieta', 'Miguel Rivera', 'Carmen Solís',
        'Roberto Martínez', 'Ana Luisa', 'Juana Cruz', 'Víctor Hugo', 'Luz Esther',
        'Francisco Pérez', 'Teresa Colón', 'Jorge Luis', 'Ángel Vega', 'Héctor Pagán'
    ];
    const patients = [];
    for (const [i, name] of patientNames.entries()) {
        const existing = await prisma.patient.findFirst({ where: { name, headquartersId: cupeyId } });
        const p = existing ?? await prisma.patient.create({
            data: {
                name, headquartersId: cupeyId,
                roomNumber: `A-${100 + i}`,
                colorGroup: i % 3 === 0 ? ColorGroup.RED : (i % 2 === 0 ? ColorGroup.YELLOW : ColorGroup.GREEN),
                diet: i % 2 === 0 ? 'Regular' : 'Diabética',
                downtonRisk: i % 2 === 0,
            }
        });
        patients.push(p);
    }
    console.log(`[✅] 15 pacientes listos.`);

    // --- 4. eMar: MEDICAMENTOS + ADMINISTRACIONES ---
    const medNames = ['Metformina 500mg', 'Lisinopril 10mg', 'Atorvastatina 20mg', 'Losartán 50mg', 'Omeprazol 20mg'];
    const meds = [];
    for (const name of medNames) {
        let med = await prisma.medication.findFirst({ where: { name } });
        if (!med) med = await prisma.medication.create({
            data: { name, dosage: '1 tableta', route: 'Oral', category: 'Crónica', isGlobalMaster: true }
        });
        meds.push(med);
    }

    const adminStatuses: MedStatus[] = ['ADMINISTERED', 'ADMINISTERED', 'MISSED', 'PENDING', 'ADMINISTERED', 'REFUSED', 'PENDING', 'MISSED'];

    for (let i = 0; i < 8; i++) {
        const patient = patients[i];
        const med = meds[i % meds.length];
        const caregiver = [pedro, maria, jose, laura][i % 4];
        if (!caregiver) continue;

        let patMed = await prisma.patientMedication.findFirst({ where: { patientId: patient.id, medicationId: med.id } });
        if (!patMed) {
            patMed = await prisma.patientMedication.create({
                data: {
                    patientId: patient.id,
                    medicationId: med.id,
                    frequency: 'DIARIO',
                    scheduleTimes: '08:00',
                    status: MedActiveStatus.ACTIVE,
                    prescribedBy: 'Dr. Ramírez',
                    startDate: new Date(),
                }
            });
        }

        const scheduledTime = new Date();
        scheduledTime.setHours(8, 0, 0, 0);

        await prisma.medicationAdministration.upsert({
            where: { patientMedicationId_scheduledTime: { patientMedicationId: patMed.id, scheduledTime } },
            update: { status: adminStatuses[i] },
            create: {
                patientMedicationId: patMed.id,
                administeredById: caregiver.id,
                scheduledTime,
                scheduledFor: '08:00',
                administeredAt: adminStatuses[i] === 'ADMINISTERED' ? new Date() : null,
                status: adminStatuses[i],
                notes: adminStatuses[i] === 'MISSED' ? 'Residente no disponible en hora programada' :
                       adminStatuses[i] === 'REFUSED' ? 'Residente rechazó medicamento' : null,
            }
        });
    }
    console.log(`[✅] eMAR con estados mixtos creado.`);

    // --- 5. SHIFT SESSIONS (personal activo en piso) ---
    // Schema real: caregiverId (no userId), startTime (no clockIn), actualEndTime (no clockOut)
    const shiftUsers = [pedro, maria, jose, laura].filter(Boolean) as NonNullable<typeof pedro>[];
    for (const [i, u] of shiftUsers.entries()) {
        if (!u) continue;
        const existing = await prisma.shiftSession.findFirst({ where: { caregiverId: u.id, actualEndTime: null } });
        if (!existing) {
            await prisma.shiftSession.create({
                data: {
                    caregiverId: u.id,
                    headquartersId: cupeyId,
                    startTime: new Date(Date.now() - (i + 1) * 60 * 60 * 1000),
                }
            });
        }
    }
    // Pedro: sesión zombi abierta hace 14h
    if (pedro) {
        const existingZombie = await prisma.shiftSession.findFirst({ where: { caregiverId: pedro.id, actualEndTime: null } });
        if (existingZombie) {
            await prisma.shiftSession.update({
                where: { id: existingZombie.id },
                data: { startTime: new Date(Date.now() - 14 * 60 * 60 * 1000) }
            });
        }
    }
    console.log(`[✅] ShiftSessions activas creadas (incluyendo zombi de Pedro).`);

    // --- 6. TRIAGE TICKETS ---
    // Schema real: priority (HIGH/MEDIUM/LOW), originType (TicketOriginType enum), description, status
    // No existen: title, urgency, category, sourceType
    const triageData = [
        { priority: 'HIGH', originType: 'MANUAL', description: 'Caída reportada sin atención confirmada. Residente encontrada en el piso del baño. Sin evaluación médica registrada.', patientIdx: 0 },
        { priority: 'HIGH', originType: 'EMAR_MISS', description: 'Dosis AM no administrada — 40 min vencido. Metformina 08:00 marcada como MISSED. Residente con historial de hipoglucemia.', patientIdx: 1 },
        { priority: 'MEDIUM', originType: 'MANUAL', description: 'Signos vitales no registrados en turno. Última lectura hace 26 horas. PAI indica monitoreo diario obligatorio.', patientIdx: 2 },
        { priority: 'MEDIUM', originType: 'INCIDENT', description: 'Turno anterior sin nota de handover. Cuidador saliente no completó cierre formal. Continuidad comprometida.', patientIdx: 3 },
        { priority: 'LOW', originType: 'MANUAL', description: 'Solicitud familiar pendiente de respuesta. Familiar solicita actualización de estado clínico del residente.', patientIdx: 4 },
    ];

    for (const t of triageData) {
        const existing = await prisma.triageTicket.findFirst({ where: { headquartersId: cupeyId, patientId: patients[t.patientIdx].id } });
        if (!existing) {
            await prisma.triageTicket.create({
                data: {
                    headquartersId: cupeyId,
                    patientId: patients[t.patientIdx].id,
                    priority: t.priority as any,
                    originType: t.originType as any,
                    description: t.description,
                    status: 'OPEN',
                }
            });
        }
    }
    console.log(`[✅] TriageTickets con prioridades mixtas creados.`);

    // --- 7. PERFORMANCE SCORES ---
    const perfUsers = [pedro, maria, jose, laura].filter(Boolean) as NonNullable<typeof pedro>[];
    for (const [i, u] of perfUsers.entries()) {
        if (!u) continue;
        const existing = await prisma.performanceScore.findFirst({ where: { userId: u.id } });
        if (!existing) {
            await prisma.performanceScore.create({
                data: {
                    userId: u.id,
                    headquartersId: cupeyId,
                    systemScore: [92, 78, 85, 61][i],
                    humanScore: i === 1 ? 82 : null,
                    finalScore: [92, 82, 85, 61][i],
                    systemFindings: i === 3 ? { emar_missed: 3, handover_incomplete: 2 } : {},
                    periodStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                    periodEnd: new Date(),
                }
            });
        }
    }
    console.log(`[✅] PerformanceScores creados.`);

    // --- 8. ACADEMY ASSIGNMENTS ---
    if (laura) {
        const existing = await prisma.academyAssignment.findFirst({ where: { userId: laura.id } });
        if (!existing) {
            await prisma.academyAssignment.create({
                data: {
                    userId: laura.id,
                    headquartersId: cupeyId,
                    moduleCode: 'EMAR_COMPLIANCE_101',
                    reason: 'Tres dosis MISSED en período quincenal — patrón repetido. Módulo: Protocolo eMAR: Administración y Registro Correcto',
                    status: 'PENDING',
                }
            });
        }
    }
    console.log(`[✅] AcademyAssignment creado para Laura.`);

    // --- 9. HEADQUARTERS EVENTS (para react-big-calendar) ---
    const hqEventTypes = ['LABORATORY', 'MEDICAL_VISIT', 'FAMILY_VISIT', 'ACTIVITY', 'OTHER'];
    const hqEventTitles = ['Laboratorios en Ayunas', 'Visita Dr. Ramírez', 'Día de Familias', 'Terapia Recreativa Grupal', 'Reunión Administrativa'];
    for (let i = 0; i < 5; i++) {
        const existing = await prisma.headquartersEvent.findFirst({ where: { title: hqEventTitles[i], headquartersId: cupeyId } });
        if (!existing) {
            const start = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
            start.setHours(9 + i, 0, 0, 0);
            const end = new Date(start);
            end.setHours(start.getHours() + 2);
            await prisma.headquartersEvent.create({
                data: {
                    headquartersId: cupeyId,
                    title: hqEventTitles[i],
                    type: hqEventTypes[i] as any,
                    startTime: start,
                    endTime: end,
                    description: `Evento institucional generado por seed de staging.`,
                    targetPopulation: 'ALL',
                }
            });
        }
    }
    console.log(`[✅] HeadquartersEvents creados (react-big-calendar).`);

    // --- 10. CALENDAR EVENTS (para TransversalCalendar) ---
    const eventTypes = ['FACILITY_ROUTINE', 'MEDICAL_APPOINTMENT', 'FACILITY_ROUTINE', 'THERAPY', 'REEVALUATION_DUE'];
    for (let i = 0; i < 5; i++) {
        const existing = await prisma.calendarEvent.findFirst({ where: { title: `Actividad Programada ${i + 1}`, headquartersId: cupeyId } });
        if (!existing) {
            await prisma.calendarEvent.create({
                data: {
                    headquartersId: cupeyId,
                    patientId: patients[i].id,
                    assignedToId: i % 2 === 0 && pedro ? pedro.id : null,
                    type: eventTypes[i] as any,
                    status: 'SCHEDULED',
                    title: `Actividad Programada ${i + 1}`,
                    description: 'Generado por seed de staging',
                    originContext: 'SEED_SCRIPT',
                    startTime: new Date(Date.now() + i * 60 * 60 * 1000),
                }
            });
        }
    }
    console.log(`[✅] CalendarEvents listos.`);

    console.log(`[🎉] STAGING SEED COMPLETO — todos los módulos cubiertos.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
