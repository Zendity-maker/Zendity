import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { headquartersId, supervisorId, caregiverId, description, sourceType, sourceId, expirationMins } = body;

        if (!headquartersId || !supervisorId || !caregiverId || !description) {
            return NextResponse.json({ error: "Missing required fields for dispatch" }, { status: 400 });
        }

        const expiresAt = new Date(Date.now() + (expirationMins || 15) * 60000);

        // 1. Create the FastActionAssignment
        const assignment = await prisma.fastActionAssignment.create({
            data: {
                headquartersId,
                supervisorId,
                caregiverId,
                description,
                expiresAt,
                status: 'PENDING'
            }
        });

        // 2. Mark the source as handled if possible
        if (sourceType === 'COMPLAINT' && sourceId) {
            await prisma.complaint.update({
                where: { id: sourceId },
                data: { status: 'ROUTED_NURSING' }
            });
        }
        
        // ZENDI GROUP handling: if sourceId is an array of IDs
        if (sourceType === 'ZENDI_GROUP' && Array.isArray(sourceId)) {
            const cleanIds = sourceId
                .filter(id => typeof id === 'string' && id.startsWith('cmp_'))
                .map(id => id.replace('cmp_', ''));
                
            if (cleanIds.length > 0) {
                await prisma.complaint.updateMany({
                    where: { id: { in: cleanIds } },
                    data: { status: 'RESOLVED' }
                });
            }
        }

        return NextResponse.json({ success: true, assignment });
    } catch (error: unknown) {
        console.error("Error creating fast action assignment:", error);
        return NextResponse.json({ error: (error as Error).message || "Internal server error" }, { status: 500 });
    }
}
