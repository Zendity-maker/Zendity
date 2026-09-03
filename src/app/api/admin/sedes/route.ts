import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { crearAcuerdosPendientes } from '@/lib/acuerdos-sede';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import sgMail from '@sendgrid/mail';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { normalizePlan, calculateMonthlyFee, BED_PRICE } from '@/lib/entitlements';
import { ENROLLED_PATIENT_STATUSES } from '@/lib/billable-residents';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sedes — lista de sedes (tenants) con contrato, counts,
 * última actividad y health score (0-100).
 *
 * Health score:
 *   +25  si tuvo ShiftSession en las últimas 24h
 *   +25  si hubo MedicationAdministration hoy
 *   +25  si saasContract.status === 'ACTIVE'
 *   +25  si licenseActive === true
 */
export async function GET() {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

        const sedes = await prisma.headquarters.findMany({
            include: {
                saasContract: true,
                _count: {
                    select: {
                        // Matrícula: el hospitalizado sigue siendo residente.
                        // Deja de contar solo al darse de baja o egresar.
                        patients: { where: { status: { in: ENROLLED_PATIENT_STATUSES } } },
                        users: { where: { isActive: true, isDeleted: false } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Pre-cargar métricas por HQ en paralelo
        const enriched = await Promise.all(
            sedes.map(async (s) => {
                const [lastShift, medsToday] = await Promise.all([
                    prisma.shiftSession.findFirst({
                        where: { headquartersId: s.id },
                        orderBy: { startTime: 'desc' },
                        select: { startTime: true },
                    }),
                    prisma.medicationAdministration.count({
                        where: {
                            administeredAt: { gte: todayStart },
                            administeredBy: { headquartersId: s.id },
                        },
                    }),
                ]);

                let health = 0;
                if (lastShift && lastShift.startTime >= dayAgo) health += 25;
                if (medsToday > 0) health += 25;
                if (s.saasContract?.status === 'ACTIVE') health += 25;
                if (s.licenseActive) health += 25;

                return {
                    ...s,
                    lastActivity: lastShift?.startTime || null,
                    medsToday,
                    healthScore: health,
                };
            })
        );

        return NextResponse.json({ success: true, sedes: enriched });
    } catch (e: any) {
        console.error('[/api/admin/sedes GET]', e);
        return NextResponse.json({ success: false, error: 'Error cargando sedes' }, { status: 500 });
    }
}

/**
 * POST /api/admin/sedes — onboarding atómico: crea HQ + Director root + contrato SaaS.
 * pinCode hasheado con bcrypt (vs. legacy plano).
 */
export async function POST(req: Request) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const body = await req.json();
        const {
            name,
            capacity,
            licenseMonths,
            directorName,
            directorEmail,
            directorPinCode,
            ownerPhone,
            taxId,
            billingAddress,
            // Telefono de la SEDE, distinto del del dueño: es el que sale
            // impreso en el formulario de traslado de emergencia que va con el
            // residente al hospital. No se pedia, y las dos sedes de Vivid
            // quedaron sin el.
            phone,
            plan,
            pricePerBed,
            beds,
            monthlyAmount,
        } = body;

        if (!name || !directorEmail || !directorPinCode || !licenseMonths) {
            return NextResponse.json({ success: false, error: 'name, directorEmail, directorPinCode y licenseMonths son obligatorios' }, { status: 400 });
        }

        const licenseExpiry = new Date();
        licenseExpiry.setMonth(licenseExpiry.getMonth() + Number(licenseMonths));

        const pinHash = await bcrypt.hash(String(directorPinCode), 10);

        const result = await prisma.$transaction(async (tx) => {
            const hq = await tx.headquarters.create({
                data: {
                    name,
                    capacity: capacity ? Number(capacity) : 50,
                    licenseActive: true,
                    licenseExpiry,
                    ownerName: directorName || null,
                    ownerEmail: directorEmail,
                    ownerPhone: ownerPhone || null,
                    taxId: taxId || null,
                    billingAddress: billingAddress || null,
                    phone: phone || null,
                    subscriptionPlan: normalizePlan(plan) || 'PRO',
                    subscriptionStatus: 'ACTIVE',
                },
            });

            const director = await tx.user.create({
                data: {
                    headquartersId: hq.id,
                    name: directorName || 'Director',
                    email: directorEmail.toLowerCase().trim(),
                    pinCode: pinHash,
                    role: Role.DIRECTOR,
                    complianceScore: 100,
                },
            });

            // El contrato se crea SIEMPRE, derivado de la capacidad autorizada.
            // Antes dependía de que el formulario mandara plan+beds+monthlyAmount:
            // si faltaba alguno, la sede nacía sin contrato y por tanto sin nada
            // que facturar. Con tarifa única no hay nada que preguntar —
            // camas × $12.49.
            const startDate = new Date();
            const renewalDate = new Date(startDate);
            renewalDate.setFullYear(renewalDate.getFullYear() + 1);
            const camas = hq.capacity;
            const contract = await tx.saaSContract.create({
                data: {
                    headquartersId: hq.id,
                    plan: 'PRO', // vestigio del modelo de planes; ya no diferencia
                    pricePerBed: BED_PRICE,
                    beds: camas,
                    monthlyAmount: calculateMonthlyFee(camas),
                    startDate,
                    renewalDate,
                    status: 'ACTIVE',
                },
            });

            return { hq, director, contract };
        });

        // El BAA nace PENDIENTE junto con la sede. Sin esta fila, la sede no
        // tendria nada que firmar y el candado de creacion de residentes la
        // dejaria bloqueada sin salida visible. Fuera de la transaccion: si
        // fallara, la sede queda creada y el acuerdo se genera al entrar a
        // /corporate/acuerdos — preferible a revertir un alta completa.
        try {
            await crearAcuerdosPendientes(result.hq.id, result.hq.name, null);
        } catch (e) {
            console.error('[admin/sedes] no se pudo crear el BAA pendiente:', e);
        }

        // ── Email de bienvenida ─────────────────────────────────────────
        const sgKey = process.env.SENDGRID_API_KEY;
        if (sgKey) {
            try {
                sgMail.setApiKey(sgKey);
                await sgMail.send({
                    to: directorEmail,
                    from: process.env.SENDGRID_FROM_EMAIL as string,
                    subject: `Bienvenido a Zéndity — ${name}`,
                    html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
                        <div style="background: linear-gradient(135deg, #0F6B78, #3CC6C4); padding: 36px 32px; border-radius: 12px 12px 0 0; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px;">Zéndity</h1>
                            <p style="color: rgba(255,255,255,0.75); margin: 8px 0 0; font-size: 14px;">Healthcare Management Platform</p>
                        </div>
                        <div style="background: #f8fafc; padding: 36px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                            <h2 style="margin-top: 0; font-size: 22px;">¡Bienvenido${directorName ? `, ${directorName}` : ''}!</h2>
                            <p style="color: #475569; line-height: 1.6;">
                                Tu sede <strong style="color: #0f172a;">${name}</strong> ha sido activada exitosamente
                                en la plataforma Zéndity. Ya puedes acceder y comenzar a configurar tu equipo y residentes.
                            </p>

                            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; margin: 28px 0;">
                                <h3 style="margin: 0 0 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;">Credenciales de acceso</h3>
                                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; width: 80px;">Email</td>
                                        <td style="padding: 6px 0; font-weight: 600;">${directorEmail}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b;">PIN</td>
                                        <td style="padding: 6px 0;">
                                            <span style="font-family: monospace; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 4px 12px; border-radius: 6px; font-size: 20px; font-weight: 900; letter-spacing: 4px;">${directorPinCode}</span>
                                        </td>
                                    </tr>
                                </table>
                                <p style="color: #ef4444; font-size: 12px; margin: 16px 0 0; display: flex; align-items: center; gap: 6px;">
                                    ⚠️ Cambia tu PIN en cuanto accedas por primera vez desde Configuración → Mi perfil.
                                </p>
                            </div>

                            <a href="https://app.zendity.com/login"
                               style="display: inline-block; background: linear-gradient(135deg, #0F6B78, #3CC6C4); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 800; font-size: 15px; margin-bottom: 28px;">
                                Acceder a Zéndity →
                            </a>

                            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.6;">
                                    ¿Tienes preguntas? Escríbenos a
                                    <a href="mailto:zendityinfo@gmail.com" style="color: #0F6B78; font-weight: 600;">zendityinfo@gmail.com</a>
                                    o WhatsApp al (787) 200-0000.<br/>
                                    El equipo de Zéndity está disponible para ayudarte durante tu arranque.
                                </p>
                            </div>
                        </div>
                    </div>`,
                });
                console.log('[sedes POST] Welcome email enviado a:', directorEmail);
            } catch (emailErr) {
                // No-fatal: la sede fue creada, el email es secundario
                console.error('[sedes POST] Welcome email error:', emailErr);
            }
        }

        return NextResponse.json({ success: true, onboarding: result });
    } catch (e: any) {
        console.error('[/api/admin/sedes POST]', e);
        if (e.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Email o sede ya existen' }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: 'Error en onboarding' }, { status: 500 });
    }
}
