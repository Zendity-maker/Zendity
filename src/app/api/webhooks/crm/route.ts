import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import {  LeadStage } from '@prisma/client';



export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || authHeader !== `Bearer ${process.env.ZENDITY_WEBHOOK_SECRET}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Required fields
        if (!body.headquartersId || !body.firstName || !body.lastName) {
             return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const result = await prisma.cRMLead.create({
            data: {
                headquartersId: body.headquartersId,
                firstName: body.firstName,
                lastName: body.lastName,
                email: body.email || null,
                phone: body.phone || null,
                notes: body.notes || null,
                stage: LeadStage.PROSPECT
            }
        });

        return NextResponse.json({ success: true, lead: result }, { status: 201 });
    } catch (error) {
        console.error('Webhook CRM Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to process webhook' }, { status: 500 });
    }
}
