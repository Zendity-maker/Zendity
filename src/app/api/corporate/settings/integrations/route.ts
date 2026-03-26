import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const headquartersId = searchParams.get("headquartersId");

        if (!headquartersId) return NextResponse.json({ error: "headquartersId is required" }, { status: 400 });

        let integrations = await prisma.hqIntegration.findUnique({
            where: { headquartersId }
        });

        // Si no existe el registro de integraciones, devolver uno vacío temporal
        if (!integrations) {
            integrations = {
                id: '', headquartersId,
                vapiApiKey: null, twilioApiKey: null,
                sendgridApiKey: null, docusignApiKey: null,
                createdAt: new Date(), updatedAt: new Date()
            };
        }

        const hqData = await prisma.headquarters.findUnique({
            where: { id: headquartersId },
            select: { phone: true, logoUrl: true }
        });

        return NextResponse.json({
            integrations,
            whiteLabel: hqData
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { headquartersId, integrations, whiteLabel } = body;

        if (!headquartersId) return NextResponse.json({ error: "headquartersId is required" }, { status: 400 });

        // Upsert de HqIntegration
        const updatedIntegrations = await prisma.hqIntegration.upsert({
            where: { headquartersId },
            update: {
                vapiApiKey: integrations.vapiApiKey,
                twilioApiKey: integrations.twilioApiKey,
                sendgridApiKey: integrations.sendgridApiKey,
                docusignApiKey: integrations.docusignApiKey
            },
            create: {
                headquartersId,
                vapiApiKey: integrations.vapiApiKey,
                twilioApiKey: integrations.twilioApiKey,
                sendgridApiKey: integrations.sendgridApiKey,
                docusignApiKey: integrations.docusignApiKey
            }
        });

        if (whiteLabel) {
            await prisma.headquarters.update({
                where: { id: headquartersId },
                data: {
                    phone: whiteLabel.phone,
                    logoUrl: whiteLabel.logoUrl
                }
            });
        }

        return NextResponse.json(updatedIntegrations);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Failed to update integrations" }, { status: 500 });
    }
}
