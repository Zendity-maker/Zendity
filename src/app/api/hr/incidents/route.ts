import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import sgMail from '@sendgrid/mail';

export const dynamic = 'force-dynamic';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { employeeId, supervisorId, headquartersId, type, description, signatureBase64 } = body;

        if (!employeeId || !supervisorId || !headquartersId || !type || !description) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos.' }, { status: 400 });
        }

        const newIncident = await prisma.incidentReport.create({
            data: {
                employeeId,
                supervisorId,
                headquartersId,
                type,
                description,
                signatureBase64: signatureBase64 || null,
                signedAt: signatureBase64 ? new Date() : null,
            },
            include: {
                employee: { select: { email: true, name: true } },
                hq: { select: { name: true, logoUrl: true } }
            }
        });

        // ==========================
        // SendGrid Email Notification
        // ==========================
        if (newIncident.employee?.email && newIncident.employee.email.includes('@')) {
            const hqName = newIncident.hq?.name || 'Zendity Care Center';
            const actionString = type === 'WARNING' ? 'Amonestación Escrita' : type === 'SUSPENSION' ? 'Suspensión Temporal' : 'Despido Justificado';
            
            const logoHtml = newIncident.hq?.logoUrl ? `<img src="${newIncident.hq.logoUrl}" alt="${hqName}" style="max-height: 80px; margin-bottom: 20px; object-fit: contain;" />` : '';
            
            const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #C9D4D8; border-radius: 8px; background-color: #f8fafc; padding: 30px;">
                <div style="text-align: center; border-bottom: 2px solid #0F6B78; padding-bottom: 20px; margin-bottom: 30px;">
                    ${logoHtml}
                    <div style="font-size: 13px; font-weight: bold; color: #1F2D3A; text-transform: uppercase; letter-spacing: 2px;">Departamento de Recursos Humanos</div>
                </div>
                
                <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #1F2D3A; line-height: 1.6; font-size: 15px;">
                    <h3 style="color: #9f1239; margin-top: 0; font-size: 20px; border-bottom: 1px solid #ffe4e6; padding-bottom: 10px;">Aviso de Acción Disciplinaria Automática</h3>
                    
                    <p>Estimado(a) <strong>${newIncident.employee.name}</strong>,</p>
                    
                    <p>Se ha emitido y anexado un nuevo reporte en su expediente corporativo con fecha ${new Date().toLocaleDateString('es-ES')}.</p>
                    
                    <div style="background-color: #fff1f2; padding: 15px; border-left: 4px solid #f43f5e; margin: 20px 0;">
                        <span style="font-size: 12px; font-weight: bold; color: #9f1239; text-transform: uppercase; display: block; margin-bottom: 5px;">Tipo de Acción:</span>
                        <p style="margin: 0; font-weight: bold; color: #e11d48;">${actionString}</p>
                    </div>

                    <p>Por favor, acceda al portal de Zendity RRHH en la brevedad posible para revisar los detalles del acta si no lo ha hecho ya de manera presencial.</p>
                    
                    <div style="margin-top: 40px; border-top: 1px dashed #C9D4D8; padding-top: 20px;">
                        <p style="margin: 0; font-weight: bold; color: #0F6B78;">Atentamente,</p>
                        <p style="margin: 5px 0 0 0; color: #1F2D3A;">La Dirección de RRHH y Operaciones</p>
                        <p style="margin: 0; color: #1F2D3A; font-weight: bold;">${hqName}</p>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #1F2D3A;">
                    <p style="margin: 0;">Has recibido este mensaje automático de Zendity OS.</p>
                </div>
            </div>
            `;

            if (process.env.SENDGRID_API_KEY) {
                try {
                    await sgMail.send({
                        to: newIncident.employee.email,
                        from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: hqName },
                        subject: `[RRHH] Aviso de Acción Disciplinaria - ${hqName}`,
                        html: emailHtml
                    });
                } catch (sgError) {
                    console.error("Failed to dispatch SendGrid Email for Incident:", sgError);
                }
            } else {
                console.log("Mocked SendGrid Disciplinary Email to:", newIncident.employee.email);
            }
        }

        return NextResponse.json({ success: true, incident: newIncident });
    } catch (error: any) {
        console.error("Error creating HR incident:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');
        const hqId = searchParams.get('hqId');

        if (!hqId && !employeeId) return NextResponse.json({ success: false, error: 'Faltan parámetros' }, { status: 400 });

        const whereClause: any = {};
        if (employeeId) {
            whereClause.employeeId = employeeId;
        } else {
            whereClause.headquartersId = hqId;
        }

        const incidents = await prisma.incidentReport.findMany({
            where: whereClause,
            include: {
                supervisor: { select: { id: true, name: true, role: true } },
                employee: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, incidents });
    } catch (error: any) {
        console.error("Error fetching HR incidents:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
