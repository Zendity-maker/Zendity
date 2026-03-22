import { PrismaClient, Role, ColorGroup, MedStatus, IncidentType, Severity } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log(`Start seeding ...`)

    // 1. Crear Sede Principal: Vivid Senior Living
    let hq = await prisma.headquarters.findFirst({
        where: { name: 'Vivid Senior Living Cupey' },
    })

    if (!hq) {
        hq = await prisma.headquarters.create({
            data: {
                name: 'Vivid Senior Living Cupey',
                licenseActive: true,
                licenseExpiry: new Date('2028-12-31'),
            },
        })
        console.log(`Created Headquarters: ${hq.name}`)
    } else {
        console.log(`Headquarters already exists: ${hq.name}`)
    }

    const users = [
        {
            email: 'admin@vividcupey.com',
            name: 'Andrés Flores (Director)',
            pinCode: '1234',
            role: Role.ADMIN,
        },
        {
            email: 'enfermera@vividcupey.com',
            name: 'Carmen (Enfermera Jefe)',
            pinCode: '1111',
            role: Role.NURSE,
        },
        {
            email: 'cuidador@vividcupey.com',
            name: 'Pedro (Cuidador Zona Amarilla)',
            pinCode: '2222',
            role: Role.CAREGIVER,
        },
    ]

    for (const u of users) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { pinCode: u.pinCode },
            create: {
                email: u.email,
                name: u.name,
                pinCode: u.pinCode,
                role: u.role,
                headquartersId: hq.id,
            },
        })
        console.log(`Upserted User: ${user.name} (${user.role})`)
    }

    // 3. Crear Paciente Ficticio de Prueba
    // Para que el Dashboard esté vivo.
    let patient = await prisma.patient.findFirst({
        where: { name: 'Doña Rosa García' }
    })

    if (!patient) {
        patient = await prisma.patient.create({
            data: {
                name: 'Doña Rosa García',
                headquartersId: hq.id,
                roomNumber: '102B',
                diet: 'Diabética / Baja en Sodio',
                downtonRisk: true,
                colorGroup: ColorGroup.YELLOW,
            }
        })
        console.log(`Created Patient: ${patient.name}`)
    }

    // 3.5 Crear Familiar Vinculado (B2C Access)
    let familyMember = await prisma.familyMember.findFirst({
        where: { email: 'hija@vividcupey.com' }
    });

    if (!familyMember) {
        familyMember = await prisma.familyMember.create({
            data: {
                name: 'María García (Hija)',
                email: 'hija@vividcupey.com',
                passcode: '889900', // Demo Familiar Passcode
                accessLevel: 'Full',
                headquartersId: hq.id,
                patientId: patient.id
            }
        });
        console.log(`Created Family Member: ${familyMember.name} (Access to ${patient.name})`);
    } else {
        console.log(`Family Member already exists: ${familyMember.name}`);
    }

    // 4. Crear cursos en Academy con Imágenes y Categorías (Programa Integral de Formación)
    const fs = require('fs');
    const path = require('path');
    
    let coursesToSeed = [];
    try {
        const rawdata = fs.readFileSync(path.join(__dirname, 'academyData.json'));
        coursesToSeed = JSON.parse(rawdata);
    } catch(e) {
        console.error("Error reading academyData.json", e);
    }

    // Inyectar headquartersId para todos los cursos del JSON
    coursesToSeed = coursesToSeed.map((c: any) => ({...c, headquartersId: hq.id}));

    for (const c of coursesToSeed) {
        let existingCourse = await prisma.course.findFirst({ where: { title: c.title, headquartersId: hq.id } });
        if (!existingCourse) {
            await prisma.course.create({ data: c });
            console.log(`Created Certified Course: ${c.title}`);
        } else {
            await prisma.course.update({ where: { id: existingCourse.id }, data: c });
            console.log(`Updated Certified Course: ${c.title}`);
        }
    }

    // 5. Crear Mensaje Familiar de Prueba (Family Link)
    const existingMessages = await prisma.familyMessage.count({
        where: { patientId: patient.id }
    });

    if (existingMessages === 0 && familyMember) {
        await prisma.familyMessage.create({
            data: {
                patientId: patient.id,
                senderType: 'FAMILY',
                senderId: familyMember.id,
                content: '¡Hola al equipo de cuidadores! Solo quería verificar si mamá pudo desayunar avena esta mañana. ¡Gracias por cuidarla!',
                isRead: false
            }
        });
        console.log(`Created dummy FamilyMessage for ${patient.name}`);
    }

    // 6. Especialistas B2B
    const specialists = [
        { email: 'terapista@vividcupey.com', name: 'Dr. Roberto (Terapista Físico)', pinCode: '3333', role: Role.THERAPIST },
        { email: 'belleza@vividcupey.com', name: 'Laura (Técnica de Uñas)', pinCode: '4444', role: Role.BEAUTY_SPECIALIST }
    ];
    for (const s of specialists) {
        await prisma.user.upsert({
            where: { email: s.email }, update: { pinCode: s.pinCode }, create: { ...s, headquartersId: hq.id }
        });
        console.log(`Upserted Specialist: ${s.name}`);
    }

    // 7. Concierge Services
    const concServices = [
        { name: 'Terapia Física (Única)', price: 45.0, category: 'Terapia', providerType: Role.THERAPIST },
        { name: 'Terapia Mensual', price: 160.0, category: 'Terapia', providerType: Role.THERAPIST },
        { name: 'Manicura & Pedicura', price: 35.0, category: 'Belleza', providerType: Role.BEAUTY_SPECIALIST },
        { name: 'Barbería', price: 20.0, category: 'Belleza', providerType: Role.BEAUTY_SPECIALIST }
    ];
    for (const s of concServices) {
        const existing = await prisma.conciergeService.findFirst({ where: { name: s.name, headquartersId: hq.id } });
        if (!existing) {
            await prisma.conciergeService.create({ data: { ...s, headquartersId: hq.id } });
            console.log(`Created Concierge Service: ${s.name}`);
        }
    }

    // 8. Concierge Products
    const concProducts = [
        { name: 'Pañales Adulto (Caja)', price: 32.50, category: 'Higiene', stock: 50 },
        { name: 'Ensure Plus (Caja)', price: 48.00, category: 'Nutrición', stock: 30 },
        { name: 'Gift Card - Cuidado Personal', price: 50.00, category: 'GiftCards', stock: 999 }
    ];
    for (const p of concProducts) {
        const existing = await prisma.conciergeProduct.findFirst({ where: { name: p.name, headquartersId: hq.id } });
        if (!existing) {
            await prisma.conciergeProduct.create({ data: { ...p, headquartersId: hq.id } });
            console.log(`Created Concierge Product: ${p.name}`);
        }
    }

    // 9. Zendity Pay (Invoicing Seed Data)
    const invoiceExists = await prisma.invoice.count({ where: { patientId: patient.id } });
    if (invoiceExists === 0) {
        // Factura Histórica de Febrero (Pagada)
        await prisma.invoice.create({
            data: {
                headquartersId: hq.id,
                patientId: patient.id,
                invoiceNumber: 'INV-022026-001',
                issueDate: new Date('2026-02-01T10:00:00Z'),
                dueDate: new Date('2026-02-05T23:59:59Z'),
                status: 'PAID',
                subtotal: 3500.00,
                taxRate: 0.00,
                totalAmount: 3500.00,
                notes: 'Pagado puntualmente. ¡Gracias!',
                items: {
                    create: [
                        { description: 'Estadía Mensual Base (Zona Amarilla)', quantity: 1, unitPrice: 3500.00, totalPrice: 3500.00 }
                    ]
                }
            }
        });

        // Factura del Mes Actual (Pendiente)
        await prisma.invoice.create({
            data: {
                headquartersId: hq.id,
                patientId: patient.id,
                invoiceNumber: 'INV-032026-001',
                issueDate: new Date('2026-03-01T10:00:00Z'),
                dueDate: new Date('2026-03-05T23:59:59Z'),
                status: 'PENDING',
                subtotal: 3595.00, // 3500 base + 45 terapia extra + 50 giftcard a crédito
                taxRate: 0.04,  // 4% ITBIS/IVA B2C en servicios
                totalAmount: 3738.80,
                notes: 'Favor de saldar comprobante a través del portal "Family Pagos" o en secretaría.',
                items: {
                    create: [
                        { description: 'Estadía Mensual Base (Zona Amarilla)', quantity: 1, unitPrice: 3500.00, totalPrice: 3500.00 },
                        { description: 'Concierge Marketplace: Pañales Adulto (Caja)', quantity: 1, unitPrice: 45.00, totalPrice: 45.00 },
                        { description: 'Concierge Servicios: Gift Card 50$', quantity: 1, unitPrice: 50.00, totalPrice: 50.00 }
                    ]
                }
            }
        });
        console.log(`Created 2 Sample Invoices for ${patient.name}`);
    }

    // 10. Zendity Shift Handovers (Módulo 21)
    const handoverExists = await prisma.shiftHandover.count({ where: { headquartersId: hq.id } });
    if (handoverExists === 0) {

        // Obtener a Carmen (Saliente) y Pedro (Entrante)
        const carmen = await prisma.user.findFirst({ where: { email: 'enfermera@vividcupey.com' } });
        const pedro = await prisma.user.findFirst({ where: { email: 'cuidador@vividcupey.com' } });

        if (carmen && pedro) {
            await prisma.shiftHandover.create({
                data: {
                    headquartersId: hq.id,
                    shiftType: 'MORNING', // 6am a 2pm
                    outgoingNurseId: carmen.id,
                    incomingNurseId: pedro.id,
                    status: 'PENDING', // Pedro aún no lo ha "Aceptado"
                    notes: {
                        create: [
                            {
                                patientId: patient.id,
                                clinicalNotes: 'Pasó mala noche. Presentó fiebre leve (37.8) a las 11:00 AM. Se administró Tylenol PM. Vigilar saturación y alertar al Dr. de cabecera si empeora.',
                                isCritical: true
                            }
                        ]
                    }
                }
            });
            console.log(`Created Sample Shift Handover from ${carmen.name} to ${pedro.name}`);
        }
    }

    console.log(`Seeding finished.`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
