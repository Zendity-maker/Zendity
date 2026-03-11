import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Obtain the list of family members for a patient
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        const familyMembers = await prisma.familyMember.findMany({
            where: {
                patientId: patientId,
                headquartersId: hqId
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json({ success: true, familyMembers });
    } catch (error) {
        console.error("Error fetching family members:", error);
        return NextResponse.json({ success: false, error: "Error al cargar familiares." }, { status: 500 });
    }
}

// POST: Register a new family member
export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "Privilegios insuficientes para asignar accesos." }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { name, email, passcode, accessLevel } = await req.json();

        if (!name || !email || !passcode) {
            return NextResponse.json({ success: false, error: "Debe proveer Nombre, Email y PIN." }, { status: 400 });
        }

        // Check if email already exists globally (emails must be unique across the system for family members)
        const existingEmail = await prisma.familyMember.findUnique({
            where: { email: email }
        });

        if (existingEmail) {
            return NextResponse.json({ success: false, error: "El email ingresado ya está asociado a otra cuenta." }, { status: 400 });
        }

        const newFamilyMember = await prisma.familyMember.create({
            data: {
                patientId: patientId,
                headquartersId: hqId,
                name,
                email,
                passcode,
                accessLevel: accessLevel || "Full"
            }
        });

        return NextResponse.json({ success: true, familyMember: newFamilyMember });
    } catch (error) {
        console.error("Error creating family member:", error);
        return NextResponse.json({ success: false, error: "Error al crear el perfil del familiar." }, { status: 500 });
    }
}

// DELETE: Revoke a family member's access
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "Privilegios insuficientes para revocar accesos." }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { searchParams } = new URL(req.url);
        const familyMemberId = searchParams.get('familyMemberId');

        if (!familyMemberId) {
            return NextResponse.json({ success: false, error: "ID del familiar requerido." }, { status: 400 });
        }

        // Ensure the family member belongs to this patient and HQ
        const existingMember = await prisma.familyMember.findUnique({
            where: { id: familyMemberId }
        });

        if (!existingMember || existingMember.patientId !== patientId || existingMember.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: "Acceso no autorizado o familiar no encontrado." }, { status: 403 });
        }

        await prisma.familyMember.delete({
            where: { id: familyMemberId }
        });

        return NextResponse.json({ success: true, message: "Acceso revocado exitosamente." });
    } catch (error) {
        console.error("Error deleting family member:", error);
        return NextResponse.json({ success: false, error: "Error al revocar el acceso." }, { status: 500 });
    }
}
