import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clampComplianceScore } from '@/lib/compliance-score';



// FASE 11: GET - Fetch pending fast actions for a caregiver, and auto-fail expired ones.
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const caregiverId = searchParams.get('caregiverId');

        if (!caregiverId) {
            return NextResponse.json({ success: false, error: "caregiverId is required" }, { status: 400 });
        }

        // 1. Fetch pending tasks for this caregiver
        const pendingTasks = await prisma.fastActionAssignment.findMany({
            where: {
                caregiverId,
                status: 'PENDING'
            },
            include: {
                supervisor: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Check for expired tasks
        const now = new Date();
        const expiredTasks = pendingTasks.filter((task: { id: string; expiresAt: Date }) => task.expiresAt < now);
        const validTasks = pendingTasks.filter((task: { id: string; expiresAt: Date }) => task.expiresAt >= now);

        // 3. Auto-fail expired tasks and deduct compliance points
        if (expiredTasks.length > 0) {
            for (const task of expiredTasks) {
                // Mark as FAILED
                await prisma.fastActionAssignment.update({
                    where: { id: task.id },
                    data: { status: 'FAILED' }
                });

                // Deduct points from Caregiver (-5 points per failed fast action)
                await prisma.user.update({
                    where: { id: caregiverId },
                    data: {
                        complianceScore: {
                            decrement: 5
                        }
                    }
                });
                await clampComplianceScore(caregiverId);
            }
        }

        return NextResponse.json({ success: true, tasks: validTasks });
    } catch (error) {
        console.error("Error fetching fast actions:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

// FASE 11: POST - Create a new 15-minute Fast Action Assignment (Supervisor)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { headquartersId, supervisorId, caregiverId, description } = body;

        if (!headquartersId || !supervisorId || !caregiverId || !description) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // Calculate expiration time: exactly 15 minutes from now
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const newAssignment = await prisma.fastActionAssignment.create({
            data: {
                headquartersId,
                supervisorId,
                caregiverId,
                description,
                expiresAt,
                status: 'PENDING'
            }
        });

        return NextResponse.json({ success: true, assignment: newAssignment });
    } catch (error) {
        console.error("Error creating fast action:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

// FASE 11: PATCH - Complete or Fail a fast action
export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        // Support both { taskId } (legacy caregiver) and { id, status } (supervisor)
        const id = body.id || body.taskId;
        const targetStatus: 'COMPLETED' | 'FAILED' = body.status || 'COMPLETED';

        if (!id) {
            return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
        }

        const task = await prisma.fastActionAssignment.findUnique({
            where: { id }
        });

        if (!task) {
            return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
        }

        if (task.status !== 'PENDING') {
            return NextResponse.json({ success: false, error: `Task is already ${task.status}` }, { status: 400 });
        }

        const now = new Date();

        // Si el supervisor la marca como FAILED manualmente
        if (targetStatus === 'FAILED') {
            await prisma.fastActionAssignment.update({
                where: { id },
                data: { status: 'FAILED', completedAt: now }
            });

            await prisma.user.update({
                where: { id: task.caregiverId },
                data: { complianceScore: { decrement: 5 } }
            });
            await clampComplianceScore(task.caregiverId);

            return NextResponse.json({ success: true, message: "Task marked as FAILED. 5 points deducted." });
        }

        // Si expiró durante la ejecución, fallarla automáticamente.
        if (now > task.expiresAt) {
            await prisma.fastActionAssignment.update({
                where: { id },
                data: { status: 'FAILED', completedAt: now }
            });

            await prisma.user.update({
                where: { id: task.caregiverId },
                data: { complianceScore: { decrement: 5 } }
            });
            await clampComplianceScore(task.caregiverId);

            return NextResponse.json({ success: false, error: "Task expired. Marked as FAILED and 5 points deducted." }, { status: 400 });
        }

        // Caso de éxito: Completar a tiempo
        const updatedTask = await prisma.fastActionAssignment.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                completedAt: now
            }
        });

        return NextResponse.json({ success: true, task: updatedTask });
    } catch (error) {
        console.error("Error updating fast action:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
