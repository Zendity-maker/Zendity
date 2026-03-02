import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding Fase 5: Historical Insights (6 Months data)...')

    const hq = await prisma.headquarters.findFirst();
    if (!hq) {
        console.log('No HQ found. Exiting.');
        return;
    }

    // Obtenemos todos los empleados (NURSE, CAREGIVER, ADMIN, DIRECTOR, SOCIAL_WORKER)
    const employees = await prisma.user.findMany({
        where: { role: { not: 'ADMIN' } } // Excluimos ADMIN principal para que sea el evaluador
    });

    const evaluator = await prisma.user.findFirst();

    if (!evaluator || employees.length === 0) {
        console.log('Missing evaluator or employees');
        return;
    }

    // Generar datos aleatorios simulando los últimos 6 meses
    const monthsToGenerate = 6;
    let evaluationsCreated = 0;

    for (let i = 0; i < monthsToGenerate; i++) {
        // Retroceder `i` meses desde ahora
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        // Variar el día del mes aleatoriamente
        date.setDate(Math.floor(Math.random() * 28) + 1);

        for (const emp of employees) {
            // Simular un score (60 - 100) para darle algo de variabilidad a la curva
            // Cuidadores y enfermeros tienden a tener un score base distinto a otros
            let baseScore = emp.role === 'NURSE' ? 85 : 80;

            // Añadir una variación aleatoria (-15 a +15)
            const trendVariation = Math.floor(Math.random() * 31) - 15;
            let finalScore = baseScore + trendVariation;

            // Limpiar topes (0-100)
            finalScore = Math.max(0, Math.min(100, finalScore));

            // Determinar un JSON mock categoryScores
            let categoryScores: any = {};
            if (emp.role === 'NURSE' || emp.role === 'CAREGIVER') {
                categoryScores = {
                    seguridad_clinica: finalScore,
                    higiene: Math.min(100, finalScore + 5),
                    empatia: Math.min(100, finalScore - 5)
                };
            } else {
                categoryScores = {
                    cumplimiento_df: finalScore,
                    liderazgo: Math.min(100, finalScore + 5)
                };
            }

            await prisma.employeeEvaluation.create({
                data: {
                    headquartersId: hq.id,
                    employeeId: emp.id,
                    evaluatorId: evaluator.id,
                    score: finalScore,
                    categoryScores: categoryScores,
                    feedback: `Historical Entry Month -${i} (Auto-generated)`,
                    createdAt: date
                }
            });
            evaluationsCreated++;
        }
    }

    console.log(`✅ Seed listo: ${evaluationsCreated} evaluaciones históricas insertadas para Zendity Insights.`);
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
