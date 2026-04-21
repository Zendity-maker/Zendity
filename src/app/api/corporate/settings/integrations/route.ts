import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

/**
 * CRÍTICO — Este endpoint lee/escribe API keys de integraciones externas
 * (VAPI, Twilio, SendGrid, DocuSign). ANTES estaba sin auth — cualquier
 * request podía leer o sobrescribir credenciales. Ahora restringido a
 * DIRECTOR/ADMIN y anclado a la sede del invocador.
 */
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get("headquartersId");

        let headquartersId: string;
        try {
            headquartersId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ error: e.message || 'Sede inválida' }, { status: 400 });
        }

        let integrations = await prisma.hqIntegration.findUnique({
            where: { headquartersId }
        });

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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const body = await req.json();
        const { headquartersId: bodyHqId, integrations, whiteLabel } = body;

        // hqId siempre desde sesión. Ignora body.headquartersId.
        let headquartersId: string;
        try {
            headquartersId = await resolveEffectiveHqId(session, bodyHqId || null);
        } catch (e: any) {
            return NextResponse.json({ error: e.message || 'Sede inválida' }, { status: 400 });
        }

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
