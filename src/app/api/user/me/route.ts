import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';



export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
       return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Buscamos al usuario en la BD para ver si tiene isShiftBlocked
    // Usamos findFirst pq el login es un mock de string por ahora ("admin-1", "nurse-af")
    const user = await prisma.user.findFirst({
        where: { role: "NURSE" } // Mockeamos asumiendo que es el enfermero principal
    });

    if (!user) {
        return NextResponse.json({ isShiftBlocked: false, blockReason: null });
    }

    return NextResponse.json({ 
        id: user.id,
        role: user.role,
        isShiftBlocked: user.isShiftBlocked, 
        blockReason: user.blockReason 
    });

  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
  }
}
