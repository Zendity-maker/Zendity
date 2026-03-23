import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(req: Request) {
    try {
        const data = await req.json();
        const {
            id,
            name,
            dosage,
            route,
            category,
            condition,
            isControlled,
            requiresFridge,
            withFood
        } = data;

        if (!id || !name || !dosage) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: id, name, or dosage" },
                { status: 400 }
            );
        }

        const updatedMedication = await prisma.medication.update({
            where: { id },
            data: {
                name: name.toUpperCase(), // Ensure consistency
                dosage,
                route,
                category,
                condition,
                isControlled,
                requiresFridge,
                withFood
            }
        });

        return NextResponse.json({ success: true, medication: updatedMedication });
    } catch (error) {
        console.error("MED CATALOG UPDATE Error:", error);
        return NextResponse.json({ success: false, error: "Failed to update medication." }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const {
            name,
            dosage,
            route,
            description,
            category,
            condition,
            isControlled,
            requiresFridge,
            withFood
        } = data;

        if (!name || !dosage) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: name or dosage" },
                { status: 400 }
            );
        }

        const newMedication = await prisma.medication.create({
            data: {
                name: name.toUpperCase(),
                dosage,
                route: route || "Oral",
                description: description || null,
                category: category || "General",
                condition: condition || "Otros",
                isControlled: isControlled || false,
                requiresFridge: requiresFridge || false,
                withFood: withFood || false
            }
        });

        return NextResponse.json({ success: true, medication: newMedication });
    } catch (error) {
        console.error("MED CATALOG CREATE Error:", error);
        return NextResponse.json({ success: false, error: "Failed to create medication." }, { status: 500 });
    }
}
