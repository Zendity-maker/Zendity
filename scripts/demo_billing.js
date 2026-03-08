const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addDemoInvoice() {
    const patient = await prisma.patient.findFirst({ where: { status: 'ACTIVE' } });
    if (!patient) return console.log("No active patients");

    const headquartersId = patient.headquartersId;

    await prisma.invoice.create({
        data: {
            headquartersId,
            patientId: patient.id,
            invoiceNumber: "INV-DEMO1B",
            dueDate: new Date(new Date().setDate(new Date().getDate() + 5)),
            subtotal: 3550,
            taxRate: 0,
            totalAmount: 3550,
            status: "PENDING",
            items: {
                create: [
                    { description: "Mensualidad Base", quantity: 1, unitPrice: 3500, totalPrice: 3500 },
                    { description: "Terapia Física Extra", quantity: 1, unitPrice: 50, totalPrice: 50 }
                ]
            }
        }
    });
    console.log("Demo invoice injected!");
}

addDemoInvoice().catch(console.error).finally(() => prisma.$disconnect());
