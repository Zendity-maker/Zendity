import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// FASE 12: Hidden Admin Route to inject Vivid Senior Living Mayagüez
export async function GET(req: Request) {
    // Basic security token to prevent random people from triggering this
    const { searchParams } = new URL(req.url);
    if (searchParams.get('token') !== 'vivid-mayaguez-seed-xyz') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Check if Mayaguez already exists
        const existingMayaguez = await prisma.headquarters.findFirst({
            where: { name: { contains: "Mayaguez", mode: 'insensitive' } }
        });

        if (existingMayaguez) {
            return NextResponse.json({ success: true, message: "Mayaguez branch already exists.", hq: existingMayaguez });
        }

        // Create Mayaguez with a default 120-bed capacity
        const newMayaguez = await prisma.headquarters.create({
            data: {
                name: "Vivid Senior Living Mayaguez",
                capacity: 120,
                isActive: false, // Pre-apertura by default
                licenseActive: true,
                licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year out
            }
        });

        // Verify Cupey exists, update its capacity and make sure it has the logo
        const cupey = await prisma.headquarters.findFirst({
            where: { name: { contains: "Cupey", mode: 'insensitive' } }
        });

        if (cupey) {
            await prisma.headquarters.update({
                where: { id: cupey.id },
                data: {
                    capacity: 80, // example capacity for Cupey
                    isActive: true
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: "Successfully seeded Vivid Senior Living Mayaguez",
            mayaguez: newMayaguez
        });
    } catch (error) {
        console.error("Error seeding Mayaguez:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
