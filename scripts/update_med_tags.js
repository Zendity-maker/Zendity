const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const meds = await prisma.medication.findMany();
    console.log(`Found ${meds.length} meds. Applying sample categories...`);

    // Assign some sample data to random records
    for (let i = 0; i < Math.min(60, meds.length); i++) {
        const med = meds[i];
        let category = "General";
        let isControlled = false;
        let requiresFridge = false;
        let withFood = false;

        if (i % 4 === 0) {
            category = "Psicotrópicos";
            isControlled = true;
        } else if (i % 4 === 1) {
            category = "Antibióticos";
            requiresFridge = true;
        } else if (i % 4 === 2) {
            category = "Analgésicos";
            withFood = true;
        } else {
            category = "Suplementos";
        }

        await prisma.medication.update({
            where: { id: med.id },
            data: { category, isControlled, requiresFridge, withFood }
        });
    }

    console.log("Updated sample meds.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
