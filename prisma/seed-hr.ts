import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding Fase 4 Curso Penalizador...')

    // Buscar a Andres (NURSE de prueba)
    const user = await prisma.user.findFirst({
        where: { role: 'NURSE' }
    });

    if (!user) return;

    // Asegurar que exista el curso de "Protocolos de Seguridad" (El de refuerzo)
    let securityCourse = await prisma.course.findFirst({
        where: { title: "Protocolos de Seguridad" }
    });

    if (!securityCourse) {
        const hq = await prisma.headquarters.findFirst();
        securityCourse = await prisma.course.create({
            data: {
                title: "Protocolos de Seguridad y Cuidado",
                isMandatory: true,
                headquartersId: hq?.id || ""
            }
        });
    }

    // Pre-asignar o limpiar estatus para la demo
    const userCourse = await prisma.userCourse.findFirst({
        where: { userId: user.id, courseId: securityCourse.id }
    });

    if (!userCourse) {
        await prisma.userCourse.create({
            data: {
                userId: user.id,
                courseId: securityCourse.id,
                status: "ASSIGNED"
            }
        });
    } else {
        await prisma.userCourse.update({
            where: { id: userCourse.id },
            data: { status: "ASSIGNED" }
        });
    }

    // Asegurarnos que el usuario no arrastre penalidades antes de empezar a grabar
    await prisma.user.update({
        where: { id: user.id },
        data: { isShiftBlocked: false, blockReason: null }
    });

    console.log('Seed listo para Demo de RRHH > eMAR > Academy')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
