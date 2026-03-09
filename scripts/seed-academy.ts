import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const artifactsDir = '/Users/andresfloresruiz/.gemini/antigravity/brain/ca0e5eee-1b93-4bfb-88d4-ae27e078f68e';

const courses = [
    {
        title: 'Manual de Cuidadores (Nivel I)',
        description: 'Capacitación oficial sobre los protocolos de cuidado, higiene, y alimentación en el piso clínico.',
        durationMins: 90,
        bonusCompliance: 25,
        filename: 'sop_caregiver.md'
    },
    {
        title: 'Manual de Enfermería eMAR (Nivel II)',
        description: 'Capacitación en el uso del sistema eMAR, reportes de incidentes clínicos y administración de medicamentos.',
        durationMins: 120,
        bonusCompliance: 30,
        filename: 'sop_nurse.md'
    },
    {
        title: 'Manual de Supervisor (Nivel III)',
        description: 'Capacitación en telemetría de personal, auditorías de zona y gestión del Cockpit Clínico.',
        durationMins: 60,
        bonusCompliance: 20,
        filename: 'sop_supervisor.md'
    },
    {
        title: 'Protocolos de Mantenimiento y Planta Física',
        description: 'Capacitación sobre resolución de averías, uso del Maintenance Hub y tiempos SLA.',
        durationMins: 45,
        bonusCompliance: 15,
        filename: 'sop_maintenance.md'
    },
    {
        title: 'Guía del Director Administrativo',
        description: 'Visión corporativa, control de facturación, egresos y manejo avanzado de recursos humanos.',
        durationMins: 60,
        bonusCompliance: 20,
        filename: 'sop_director.md'
    }
];

async function main() {
    console.log("Locating Headquarters...");
    const hq = await prisma.headquarters.findFirst({
        where: { name: 'Vivid Senior Living Cupey' }
    });

    if (!hq) {
        throw new Error("Sede no encontrada");
    }

    console.log("Seeding Academy Courses...");
    for (const c of courses) {
        const filePath = path.join(artifactsDir, c.filename);
        let content = "Contenido en desarrollo...";
        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf-8');
            console.log(`Leído: ${c.filename} (${content.length} caracteres)`);
        } else {
            console.log(`ADVERTENCIA: Archivo ${c.filename} no encontrado.`);
        }

        const course = await prisma.course.upsert({
            where: { id: `seed-${c.filename.replace('.md', '')}` },
            update: {
                title: c.title,
                description: c.description,
                content: content,
                durationMins: c.durationMins,
                bonusCompliance: c.bonusCompliance,
                headquartersId: hq.id,
                isActive: true
            },
            create: {
                id: `seed-${c.filename.replace('.md', '')}`,
                title: c.title,
                description: c.description,
                content: content,
                durationMins: c.durationMins,
                bonusCompliance: c.bonusCompliance,
                headquartersId: hq.id,
                isActive: true
            }
        });
        console.log(`Curso guardado/actualizado: ${course.title}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
