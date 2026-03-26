import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {  LeadStage } from '@prisma/client';



export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const body = await request.json();

        if (!Array.isArray(body.leads)) {
            return NextResponse.json({ success: false, error: 'Invalid data format' }, { status: 400 });
        }

        // Validate and prep data
        const leadsToInsert = body.leads.map((lead: any) => ({
            headquartersId: hqId,
            firstName: lead.firstName || 'Sin Nombre',
            lastName: lead.lastName || 'Sin Apellido',
            email: lead.email || null,
            phone: lead.phone || null,
            notes: lead.notes || null,
            stage: LeadStage.PROSPECT
        }));

        const result = await prisma.cRMLead.createMany({
            data: leadsToInsert,
            skipDuplicates: true
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Import Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to import leads' }, { status: 500 });
    }
}
