import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { requireSuperAdmin } from '@/lib/admin-auth';

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
                        patients: { where: { status: 'ACTIVE' } },
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
                    subscriptionPlan: plan || 'PRO',
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

            let contract = null;
            if (plan && beds && monthlyAmount) {
                const startDate = new Date();
                const renewalDate = new Date(startDate);
                renewalDate.setFullYear(renewalDate.getFullYear() + 1);
                contract = await tx.saaSContract.create({
                    data: {
                        headquartersId: hq.id,
                        plan,
                        pricePerBed: pricePerBed ? Number(pricePerBed) : 0,
                        beds: Number(beds),
                        monthlyAmount: Number(monthlyAmount),
                        startDate,
                        renewalDate,
                        status: 'ACTIVE',
                    },
                });
            }

            return { hq, director, contract };
        });

        return NextResponse.json({ success: true, onboarding: result });
    } catch (e: any) {
        console.error('[/api/admin/sedes POST]', e);
        if (e.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Email o sede ya existen' }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: 'Error en onboarding' }, { status: 500 });
    }
}
