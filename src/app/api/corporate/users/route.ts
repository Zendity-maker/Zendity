import { NextResponse } from 'next/server';

export async function GET() {
    // Mock estático de Enfermeras Locales para saltear la llamada DB a `User`
    const mockNurses = [
        { id: "u1", name: "Lucía Fernández (RN)", role: "NURSE" },
        { id: "u2", name: "Gabriel Soto (LPN)", role: "NURSE" },
    ];

    return NextResponse.json(mockNurses);
}
