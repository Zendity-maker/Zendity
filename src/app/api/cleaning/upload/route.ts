import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// Cleaning photo upload follows the same base64 pattern as the rest of Zendity.
// The photo is sent as a base64 string and returned as-is (stored inline in CleaningLog.photoUrl).
// No external cloud storage — images live directly in the PostgreSQL database.

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { imageBase64 } = await req.json();

        if (!imageBase64 || !imageBase64.startsWith('data:image')) {
            return NextResponse.json({ success: false, error: 'Imagen base64 requerida' }, { status: 400 });
        }

        // Base64 is stored directly — no cloud upload needed
        return NextResponse.json({ success: true, photoUrl: imageBase64 });
    } catch (error) {
        console.error('Cleaning Upload Error:', error);
        return NextResponse.json({ success: false, error: 'Error subiendo imagen' }, { status: 500 });
    }
}
