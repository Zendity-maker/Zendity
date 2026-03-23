import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from "@/lib/auth";

// Lista de fundadores autorizados
const SUPER_ADMIN_EMAILS = ['andresfloressrpa@gmail.com', 'admin@vividcupey.com'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        
        // Bloqueo estricto de seguridad B2B SaaS
        if (!session?.user?.email || !SUPER_ADMIN_EMAILS.includes(session.user.email)) {
            return NextResponse.json({ error: 'Acceso Denegado: Security Breach Blocked' }, { status: 403 });
        }

        const data = await req.json();
        
        // Validaciones básicas
        if (!data.name || !data.capacity || !data.licenseExpiry) {
            return NextResponse.json({ error: 'Faltan campos obligatorios para registrar la sede.' }, { status: 400 });
        }

        // Crear la nueva Sede (Headquarters)
        const nuevaSede = await prisma.headquarters.create({
            data: {
                name: data.name,
                capacity: parseInt(data.capacity),
                licenseExpiry: new Date(data.licenseExpiry),
                ownerName: data.ownerName || null,
                ownerEmail: data.ownerEmail || null,
                ownerPhone: data.ownerPhone || null,
                subscriptionPlan: data.subscriptionPlan || 'PRO',
                subscriptionStatus: 'ACTIVE',
                isActive: true,
                licenseActive: true
            }
        });

        // Opcional: Podríamos crear automáticamente un usuario ADMIN para esta sede aquí usando el email del dueño, 
        // pero por ahora lo dejamos simple para que el fundador lo maneje.

        return NextResponse.json({ success: true, sede: nuevaSede });

    } catch (error: any) {
        console.error("Error creating new Sede:", error);
        return NextResponse.json({ error: 'Error del Servidor', details: error.message }, { status: 500 });
    }
}
