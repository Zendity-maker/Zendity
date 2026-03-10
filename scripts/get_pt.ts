import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); prisma.patient.findFirst().then(console.log);
