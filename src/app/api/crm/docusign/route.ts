import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock/Envs for DocuSign (En Producción B2B se usan Integration Keys reales)
const DOCUSIGN_CLIENT_ID = process.env.DOCUSIGN_CLIENT_ID || 'mock_client';
const DOCUSIGN_USER_ID = process.env.DOCUSIGN_USER_ID || 'mock_uid';
const DOCUSIGN_PRIVATE_KEY = process.env.DOCUSIGN_PRIVATE_KEY || 'mock_key';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { leadId, hqId } = body;

        if (!leadId) {
            return NextResponse.json({ error: 'Missing CRMLead ID' }, { status: 400 });
        }

        const lead = await prisma.cRMLead.findUnique({ where: { id: leadId } });

        if (!lead) {
            return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 });
        }

        // Si tenemos llaves Reales de DocuSign
        if (DOCUSIGN_CLIENT_ID !== 'mock_client' && DOCUSIGN_PRIVATE_KEY !== 'mock_key') {
            const docusign = eval('require')('docusign-esign');
            const apiClient = new docusign.ApiClient();
            apiClient.setBasePath('https://demo.docusign.net/restapi');

            // JWT Grant Authentication
            const results = await apiClient.requestJWTUserToken(
                DOCUSIGN_CLIENT_ID,
                DOCUSIGN_USER_ID,
                ['signature', 'impersonation'],
                Buffer.from(DOCUSIGN_PRIVATE_KEY, 'utf8'),
                3600
            );

            apiClient.addDefaultHeader('Authorization', 'Bearer ' + results.body.access_token);
            const envelopesApi = new docusign.EnvelopesApi(apiClient);

            // Crear el contrato pre-poblado
            const envelopeDefinition = new docusign.EnvelopeDefinition();
            envelopeDefinition.emailSubject = `Por Favor Firme su Contrato de Admisión en Vivid Senior Living - ${lead.firstName} ${lead.lastName}`;

            const doc = new docusign.Document();
            doc.documentBase64 = Buffer.from('Contrato de Admisión Oficial...').toString('base64');
            doc.name = 'Contrato de Admisión B2B';
            doc.fileExtension = 'txt';
            doc.documentId = '1';

            envelopeDefinition.documents = [doc];

            const signer = docusign.Signer.constructFromObject({
                email: lead.email || 'mock@email.com',
                name: `${lead.firstName} ${lead.lastName}`,
                recipientId: '1',
                routingOrder: '1'
            });

            const signHere = docusign.SignHere.constructFromObject({
                anchorString: '**firma**',
                anchorYOffset: '10',
                anchorUnits: 'pixels',
                anchorXOffset: '20'
            });

            const signerTabs = docusign.Tabs.constructFromObject({
                signHereTabs: [signHere]
            });
            signer.tabs = signerTabs;

            const recipients = docusign.Recipients.constructFromObject({
                signers: [signer]
            });
            envelopeDefinition.recipients = recipients;
            envelopeDefinition.status = 'sent'; // Enviar inmediatamente

            await envelopesApi.createEnvelope('mye_account_id', { envelopeDefinition });

            // Log Interaction
            await prisma.interactionLog.create({
                data: { crmLeadId: lead.id, type: 'EMAIL', summary: `Contrato Oficial enviado vía DocuSign a ${lead.email}` }
            });

            return NextResponse.json({ success: true, message: 'DocuSign Real Enviado' });

        } else {
            // MOCK LOGIC: Cuando arrastramos la tarjeta a Contratos en el Entorno Dev
            console.log(`[MOCK DOCUSIGN] Enviando Plantilla de Contrato a: ${lead.email || lead.phone}`);

            await prisma.interactionLog.create({
                data: { crmLeadId: lead.id, type: 'EMAIL', summary: `[TEST] Sobre Legal Preparado y Mock-Enviado a ${lead.email || lead.phone}` }
            });

            // Simulate DocuSign latency
            await new Promise(resolve => setTimeout(resolve, 800));

            return NextResponse.json({ success: true, message: 'DocuSign Mock Generado y Enviado a la familia' });
        }

    } catch (error) {
        console.error('DocuSign API Error:', error);
        return NextResponse.json({ error: 'Error enviando el contrato legal.' }, { status: 500 });
    }
}
