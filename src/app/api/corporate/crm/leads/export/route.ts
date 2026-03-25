import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const leads = await prisma.cRMLead.findMany({
            where: { headquartersId: hqId },
            orderBy: { createdAt: 'desc' }
        });

        // Format data for export
        const exportData = leads.map(lead => ({
            Nombre: lead.firstName,
            Apellido: lead.lastName,
            Email: lead.email || '',
            Teléfono: lead.phone || '',
            Etapa: lead.stage,
            Notas: lead.notes || '',
            'Fecha de Creación': lead.createdAt.toISOString().split('T')[0]
        }));

        const csv = Papa.unparse(exportData);

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="prospectos_crm.csv"'
            }
        });
    } catch (error) {
        console.error('Export Error:', error);
        return new NextResponse('Failed to export leads', { status: 500 });
    }
}
