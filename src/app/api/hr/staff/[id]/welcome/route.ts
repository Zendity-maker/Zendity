import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SystemAuditAction } from '@prisma/client';
import { emailLogoSrc } from '@/lib/email-logo';
import sgMail from '@sendgrid/mail';
import bcrypt from 'bcryptjs';

/**
 * POST /api/hr/staff/[id]/welcome
 *
 * "Reenviar credenciales" — genera un PIN nuevo para el empleado, lo
 * persiste hasheado (bcrypt) Y envía el PIN PLAINTEXT por email UNA sola
 * vez. El plaintext no se loguea ni se persiste fuera del email.
 *
 * Bug histórico (corregido 11-jun-2026): este endpoint leía employee.pinCode
 * directo del DB y lo metía en el HTML del correo. Pero pinCode está
 * bcrypt-hasheado (`$2b$...`), así el empleado recibía un hash inservible
 * en lugar de su PIN. El bug "funcionaba accidentalmente" solo cuando
 * pinCode aún estaba en plaintext (creación inicial sin hash — también
 * corregido en POST /api/hr/staff).
 *
 * Comportamiento: CADA llamada genera un PIN nuevo. Si el director clica
 * dos veces, el segundo PIN invalida el primero. El frontend debería
 * advertir antes de clickear.
 *
 * Auth: DIRECTOR/ADMIN. Multi-tenant: employee debe pertenecer a la sede
 * del invocador.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const employee = await prisma.user.findFirst({
            where: { id, headquartersId: session.user.headquartersId },
            include: { headquarters: true },
        });

        if (!employee) {
            return NextResponse.json({ error: 'Empleado no encontrado en esta sede' }, { status: 404 });
        }
        if (!employee.email) {
            return NextResponse.json({ error: 'El empleado no tiene email registrado.' }, { status: 400 });
        }

        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'SendGrid no está configurado (SENDGRID_API_KEY ausente).' }, { status: 500 });
        }
        sgMail.setApiKey(apiKey);

        // 1) PIN nuevo (4 dígitos) + hash
        const newPin = String(Math.floor(Math.random() * 9000) + 1000);
        const hashed = await bcrypt.hash(newPin, 10);

        // 2) Persistir el hash ANTES de mandar el email — si SendGrid falla
        // después, el empleado puede aún usar el PIN si el director se lo
        // pasa verbalmente. El plaintext NO se persiste fuera de la
        // respuesta del email.
        await prisma.user.update({
            where: { id: employee.id },
            data: { pinCode: hashed },
        });

        // 3) Audit log — registra el reset SIN el plaintext
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: employee.headquartersId,
                    entityName: 'User',
                    entityId: employee.id,
                    action: SystemAuditAction.USER_UPDATED,
                    performedById: session.user.id,
                    payloadChanges: {
                        trigger: 'WELCOME_RESEND_PIN_RESET',
                        targetEmployeeId: employee.id,
                        targetEmployeeName: employee.name,
                        pinLength: newPin.length,
                        // PIN plaintext NUNCA al log
                    } as any,
                },
            });
        } catch (e) {
            console.error('[welcome] audit log error (no bloquea email):', e);
        }

        // 4) Email — el ÚNICO lugar donde el plaintext aparece, una sola vez
        const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';
        const facilityName = employee.headquarters?.name || 'Zendity Care Center';
        const brandPrimary = employee.headquarters?.brandPrimary || '#0F6B78';
        const logoHtml = emailLogoSrc(employee.headquartersId, employee.headquarters?.logoUrl)
            ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${emailLogoSrc(employee.headquartersId, employee.headquarters?.logoUrl)}" alt="${facilityName}" style="max-height: 80px; object-fit: contain;" /></div>`
            : '';

        const roleNames: Record<string, string> = {
            NURSE: 'Enfermera(o) a Cargo',
            CAREGIVER: 'Cuidador(a) Principal',
            SOCIAL_WORKER: 'Trabajador(a) Social',
            KITCHEN: 'Cocina y Dietas',
            MAINTENANCE: 'Mantenimiento',
            DIRECTOR: 'Director(a) de Sede',
            SUPERVISOR: 'Supervisor(a) de Planta',
        };
        const friendlyRole = roleNames[employee.role] || employee.role;

        const msg = {
            to: employee.email,
            from: { email: senderEmail, name: facilityName },
            subject: `Tus credenciales de acceso — ${facilityName}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
                ${logoHtml}
                <h2 style="color: #0f172a; text-align: center; font-weight: 800; font-size: 24px;">¡Hola, ${employee.name}!</h2>

                <div style="background-color: white; padding: 25px; border-radius: 12px; margin-top: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <p style="color: #334155; font-size: 16px; margin-top: 0;">Recursos Humanos de <strong>${facilityName}</strong> emitió un PIN nuevo para tu acceso como <strong>${friendlyRole}</strong>.</p>

                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />

                    <h3 style="color: #0f172a; margin-bottom: 15px; font-size: 18px;">Credenciales de Acceso:</h3>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        <li style="margin-bottom: 10px; font-size: 15px; color: #475569;"><strong>Usuario (Correo):</strong> <span style="font-family: monospace; font-size: 16px;">${employee.email}</span></li>
                        <li style="margin-bottom: 20px; font-size: 15px; color: #475569;"><strong>PIN de Acceso:</strong> <span style="background-color: #f1f5f9; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 20px; font-weight: bold; color: #0f172a; border: 1px solid #cbd5e1; letter-spacing: 4px;">${newPin}</span></li>
                    </ul>

                    <p style="color: #64748b; font-size: 13px; margin-top: 20px; padding: 12px; background-color: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px;">
                        ⚠️ Este PIN es <strong>nuevo</strong> y reemplaza cualquier PIN anterior.
                        Si alguien más recibió una versión previa, ese PIN ya no funciona.
                    </p>

                    <p style="color: #64748b; font-size: 13px; margin-top: 15px;">
                        Ingresa en <a href="https://app.zendity.com" style="color: ${brandPrimary}; font-weight: 600;">app.zendity.com</a> con tu correo y este PIN.
                    </p>
                </div>

                <div style="text-align: center; margin-top: 25px; color: #1F2D3A; font-size: 13px; padding-top: 15px; border-top: 1px dashed #C9D4D8;">
                    <p style="margin: 0; font-weight: 800; color: ${brandPrimary}; text-transform: uppercase; letter-spacing: 1px;">Powered by Zendity OS</p>
                    <p style="margin: 5px 0 0 0; color: #64748b;">Healthcare Operations Platform</p>
                </div>
            </div>
            `,
        };

        try {
            await sgMail.send(msg);
        } catch (sendErr: any) {
            // El PIN ya está reseteado en DB. Informamos al director del fallo
            // de email para que pueda pasar el PIN verbalmente (ver console
            // del navegador NO sirve — solo el endpoint conoce el plaintext).
            console.error('[welcome] SendGrid error:', sendErr?.response?.body || sendErr?.message);
            return NextResponse.json({
                error: 'PIN regenerado pero el correo no se pudo enviar. Contactá soporte para entrega manual.',
                pinReset: true,
                sendError: sendErr?.message ?? 'unknown',
            }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            message: `PIN nuevo enviado a ${employee.email}.`,
        });
    } catch (e: any) {
        console.error('[welcome] error:', e);
        return NextResponse.json({ error: e?.message ?? 'Fallo al regenerar credenciales.' }, { status: 500 });
    }
}
