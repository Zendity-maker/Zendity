import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;

        const staff = await prisma.user.findMany({
            where: { headquartersId: hqId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                pinCode: true,
                complianceScore: true,
                isShiftBlocked: true,
                createdAt: true
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(staff);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, email, role, pinCode } = body;
        const hqId = session.user.headquartersId;

        if (!name || !email || !role) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        const existing = await prisma.user.findUnique({
            where: { email: cleanEmail }
        });

        if (existing) {
            return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                email: cleanEmail,
                role: role,
                pinCode: pinCode || null,
                headquartersId: hqId
            }
        });

        return NextResponse.json({ success: true, user: newUser }, { status: 201 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, role, pinCode, isShiftBlocked } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        // Bloqueo de seguridad corporativa B2B
        if (id === session.user.id && isShiftBlocked === true) {
            return NextResponse.json({ error: 'No te puedes bloquear a ti mismo.' }, { status: 403 });
        }

        const updateData: any = {};
        if (role !== undefined) updateData.role = role;
        if (pinCode !== undefined) updateData.pinCode = pinCode;
        if (isShiftBlocked !== undefined) {
            updateData.isShiftBlocked = isShiftBlocked;
            if (isShiftBlocked) updateData.blockReason = "Management suspension";
            else updateData.blockReason = null;
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, user: updatedUser }, { status: 200 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
    }
}
