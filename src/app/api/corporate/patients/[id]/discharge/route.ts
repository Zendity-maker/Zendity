import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { action, leaveType, date, reason } = await req.json();
        const { id: patientId } = await params;

        if (!patientId || !action) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const patient = await prisma.patient.findUnique({
            where: { id: patientId }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
        }

        let updateData: any = {};

        switch (action) {
            case "TEMPORARY_LEAVE":
                updateData = {
                    status: "TEMPORARY_LEAVE",
                    leaveType: leaveType || "OTHER",
                    leaveDate: date ? new Date(date) : new Date(),
                };
                break;

            case "RETURN":
                updateData = {
                    status: "ACTIVE",
                    leaveType: null,
                    leaveDate: null,
                };
                break;

            case "DISCHARGE":
            case "DECEASED":
                updateData = {
                    status: action,
                    dischargeDate: date ? new Date(date) : new Date(),
                    dischargeReason: reason || "No reason provided",
                    roomNumber: null, // Liberamos el cuarto
                };
                break;

            default:
                return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
        }

        const updatedPatient = await prisma.patient.update({
            where: { id: patientId },
            data: updateData,
        });

        return NextResponse.json({ success: true, patient: updatedPatient });

    } catch (error: any) {
        console.error("Discharge Flow Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
