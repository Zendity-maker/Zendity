import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const headquartersId = searchParams.get('headquartersId');

    // Mock estático para saltear la dependencia DB en la UI del Handover
    const mockPatients = [
        { id: "p1", name: "Carmen Rivera", roomNumber: "101A" },
        { id: "4", name: "Arthur Dent", roomNumber: "204B" },
    ];

    if (!headquartersId) {
        return NextResponse.json(mockPatients);
    }

    return NextResponse.json(mockPatients);
}
