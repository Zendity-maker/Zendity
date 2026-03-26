import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function GET() {
    try {
        // En un escenario Multi-tenant con subdominios (ej. vivid.zendity.com), 
        // aquí buscaríamos la Sede por el subdominio. 
        // Por ahora, tomamos la primera sede configurada en el servidor B2B.
        const hq = await prisma.headquarters.findFirst({
            select: { logoUrl: true, name: true }
        });

        return NextResponse.json({ success: true, hq });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}
