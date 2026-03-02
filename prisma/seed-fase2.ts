import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding Fase 2 Corporate Data...')

    // Find current HQ
    const hq = await prisma.headquarters.findFirst()
    if (!hq) {
        console.log('No HQ found to seed data')
        return
    }

    // Find users and patients
    const users = await prisma.user.findMany()
    const patients = await prisma.patient.findMany()

    if (users.length === 0 || patients.length === 0) {
        console.log('No users or patients to link. Exiting.')
        return;
    }

    const nurseUser = users.find(u => u.role === 'NURSE') || users[0]
    const firstPatient = patients[0]

    // Add Wellness Diary Notes
    await prisma.wellnessDiary.create({
        data: {
            patientId: firstPatient.id,
            authorId: nurseUser.id,
            note: "El residente participó activamente en los talleres cognitivos de la mañana. Presión arterial dentro de parámetros normales (120/80).",
        }
    })

    await prisma.wellnessDiary.create({
        data: {
            patientId: firstPatient.id,
            authorId: nurseUser.id,
            note: "Descansó sin incidencias durante la noche. Demostró excelente apetito en el desayuno y toleró correctamente su medicación.",
        }
    })

    // Add Family Member
    const familyMember = await prisma.familyMember.create({
        data: {
            headquartersId: hq.id,
            patientId: firstPatient.id,
            name: "Hijo/a Representante",
            email: `familia_${Date.now()}@test.com`,
            accessLevel: "Full"
        }
    })

    // Add Survey linked to HQ and Family Member
    await prisma.familySurvey.create({
        data: {
            headquartersId: hq.id,
            familyMemberId: familyMember.id,
            ratingCare: 5,
            ratingClean: 4,
            ratingHealth: 5
        }
    })

    await prisma.familySurvey.create({
        data: {
            headquartersId: hq.id,
            familyMemberId: familyMember.id,
            ratingCare: 4,
            ratingClean: 5,
            ratingHealth: 5
        }
    })

    // Add Employee Evaluations
    await prisma.employeeEvaluation.create({
        data: {
            headquartersId: hq.id,
            employeeId: nurseUser.id,
            evaluatorId: nurseUser.id, // Para simulación el mismo evaluador/evaluado
            score: 96,
            feedback: "Excelente empatía con los residentes y total dominio de la plataforma eMAR Zendity."
        }
    })

    console.log('Seeding complete for Fase 2 - Ready for Corporate Dashboard')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
