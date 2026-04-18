import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = (session.user as any).id as string;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            role: true,
            isShiftBlocked: true,
            blockReason: true,
        }
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
