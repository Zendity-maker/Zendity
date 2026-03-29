import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Purgando datos de QA de la base de datos...");
    const hqs = await prisma.headquarters.findMany({ where: { name: 'Vivid Test HQ' } });
    
    for (const hq of hqs) {
        // Cascade delete emulated
        await prisma.systemAuditLog.deleteMany({ where: { headquartersId: hq.id } });
        // Delete shift closures
        await prisma.shiftClosure.deleteMany({ where: { headquartersId: hq.id } });
        // Nursing Handover Notes delete automatically via Cascade if defined, otherwise delete them
        const handovers = await prisma.nursingHandover.findMany({ where: { headquartersId: hq.id } });
        for (const h of handovers) {
            // commented out to fix TypeScript breaking change on old relation: await prisma.handoverPatientNote.deleteMany({ where: { handoverId: h.id } }).catch(() => {});
        }
        await prisma.nursingHandover.deleteMany({ where: { headquartersId: hq.id } });
        await prisma.triageTicket.deleteMany({ where: { headquartersId: hq.id } });
        await prisma.patient.deleteMany({ where: { headquartersId: hq.id } });
        await prisma.user.deleteMany({ where: { headquartersId: hq.id } });
        await prisma.headquarters.delete({ where: { id: hq.id } });
    }
    console.log("Capa de datos limpiada y lista para Producción real.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
