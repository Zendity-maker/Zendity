import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';



export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await request.json();
        const {
            hqName,
            directorName,
            directorEmail,
            directorPinCode,
            ownerPhone,
            taxId,
            billingAddress,
            licenseMonths,
            saasMonthlyFee
        } = data;

        if (!hqName || !directorEmail || !directorPinCode || !licenseMonths) {
            return NextResponse.json(
                { success: false, error: 'Faltan campos obligatorios para el Onboarding.' },
                { status: 400 }
            );
        }

        // Calculate License Expiry
        const licenseExpiry = new Date();
        licenseExpiry.setMonth(licenseExpiry.getMonth() + Number(licenseMonths));

        // Atomic Transaction: Create HQ -> Create Root Director -> (Optional) Create First Invoice
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the new Client (Headquarters)
            const newHq = await tx.headquarters.create({
                data: {
                    name: hqName,
                    licenseActive: true,
                    licenseExpiry: licenseExpiry,
                    ownerName: directorName,
                    ownerEmail: directorEmail,
                    ownerPhone: ownerPhone,
                    taxId: taxId,
                    billingAddress: billingAddress,
                }
            });

            // 2. Create the Root Director (Super Admin of that specific HQ)
            const newDirector = await tx.user.create({
                data: {
                    headquartersId: newHq.id,
                    name: directorName || 'Fundador/Director',
                    email: directorEmail.toLowerCase().trim(),
                    pinCode: directorPinCode,
                    role: Role.DIRECTOR,
                    complianceScore: 100,
                }
            });

            // 3. (Optional) Generate the first SaaS Invoice if a fee was stipulated
            if (saasMonthlyFee && saasMonthlyFee > 0) {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 15); // They have 15 days to pay the first invoice

                await tx.saaSInvoice.create({
                    data: {
                        headquartersId: newHq.id,
                        invoiceNumber: `SaaS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        issueDate: new Date(),
                        dueDate: dueDate,
                        status: 'PENDING',
                        subtotal: Number(saasMonthlyFee),
                        totalAmount: Number(saasMonthlyFee),
                        notes: 'Factura Inicial de Licencia Zendity OS',
                        items: {
                            create: [
                                {
                                    description: `Licencia de Operación Zendity (Mes 1/${licenseMonths})`,
                                    quantity: 1,
                                    unitPrice: Number(saasMonthlyFee),
                                    totalPrice: Number(saasMonthlyFee),
                                }
                            ]
                        }
                    }
                });
            }

            return { newHq, newDirector };
        });

        return NextResponse.json({ success: true, onboarding: result });
    } catch (error: any) {
        console.error('B2B Onboarding Error:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                { success: false, error: 'El email del director ya existe en otro asilo Zendity.' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, error: 'Fallo al inicializar el entorno del nuevo Asilo.' },
            { status: 500 }
        );
    }
}
