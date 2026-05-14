import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, format } from 'date-fns';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// Export CSV de logs de limpieza para auditorías DOH / inspecciones.
// Devuelve un archivo descargable con todos los registros del rango.
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Sesión sin sede asignada' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dateTo = to ? new Date(to) : new Date();
        const rangeStart = startOfDay(dateFrom);
        const rangeEnd = endOfDay(dateTo);

        const logs = await prisma.cleaningLog.findMany({
            where: {
                headquartersId: hqId,
                cleanedAt: { gte: rangeStart, lte: rangeEnd },
            },
            include: {
                area: { select: { name: true, floor: true, category: true, roomNumber: true } },
                cleanedBy: { select: { name: true, role: true } },
            },
            orderBy: { cleanedAt: 'asc' },
        });

        // CSV con BOM UTF-8 para que Excel reconozca acentos
        const BOM = '﻿';
        const headers = [
            'Fecha',
            'Hora',
            'Área',
            'Categoría',
            'Piso',
            'Habitación',
            'Estado',
            'Empleado',
            'Rol',
            'Productos usados',
            'Foto',
            'Notas',
        ];
        const escape = (s: string | null | undefined) => {
            if (s === null || s === undefined) return '';
            const str = String(s).replace(/"/g, '""');
            return /[",\n]/.test(str) ? `"${str}"` : str;
        };
        const rows = logs.map(l => [
            format(l.cleanedAt, 'yyyy-MM-dd'),
            format(l.cleanedAt, 'HH:mm'),
            escape(l.area?.name),
            escape(l.area?.category),
            escape(l.area?.floor),
            escape(l.area?.roomNumber || ''),
            l.status === 'COMPLETED' ? 'Completada' : 'Omitida',
            escape(l.cleanedBy?.name),
            escape(l.cleanedBy?.role),
            escape((l.productsUsed || []).join('; ')),
            l.photoUrl ? 'Sí' : 'No',
            escape(l.notes || ''),
        ].join(','));

        const csv = BOM + [headers.join(','), ...rows].join('\n');
        const filename = `limpieza_${format(rangeStart, 'yyyyMMdd')}_${format(rangeEnd, 'yyyyMMdd')}.csv`;

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('Cleaning Export Error:', error);
        return NextResponse.json({ success: false, error: 'Error generando export' }, { status: 500 });
    }
}
