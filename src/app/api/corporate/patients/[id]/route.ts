import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';



export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                headquarters: true,
                lifePlans: { orderBy: { createdAt: 'desc' }, take: 1 },
                // intakeData para que la UI compute la movilidad derivada
                // (vía src/lib/family/congruence.ts → resolveEffectiveMobility).
                intakeData: { select: { mobilityLevel: true } },
                medications: {
                    include: {
                        medication: true,
                        administrations: {
                            orderBy: { administeredAt: 'desc' },
                            include: {
                                administeredBy: { select: { id: true, name: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: "Paciente no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ success: true, patient });

    } catch (error) {
        console.error("Fetch Patient Error:", error);
        return NextResponse.json({ success: false, error: "Error detallando paciente." }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const {
            name, roomNumber, dateOfBirth,
            allergies, diagnoses, diet, colorGroup,
            idCardUrl, medicalPlanUrl, medicareCardUrl, photoUrl,
            // FASE 82 — datos legales y de seguro
            ssnLastFour, insurancePlanName, insurancePolicyNumber, preferredHospital,
            // FASE 84 — dirección previa
            address,
            // Sprint P — identificadores separados + encargado primario
            idNumber, medicareNumber, medicaidNumber, primaryFamilyMemberId,
            // Diálisis
            needsDialysis,
            // Capa de congruencia — modalidad + datos de hospicio (única fuente
            // nueva, alimentación y movilidad se derivan de campos existentes).
            // Ver src/lib/family/congruence.ts
            careModality, hospiceProvider, hospiceStartDate,
        } = body;

        const patient = await prisma.patient.findUnique({ where: { id }, include: { intakeData: true } });
        if (!patient) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });

        const updateData: any = {};

        // Solo actualizar campos que vienen definidos (no sobrescribir con undefined)
        if (name !== undefined) updateData.name = name;
        if (roomNumber !== undefined) updateData.roomNumber = roomNumber;
        if (diet !== undefined) updateData.diet = diet;
        if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
        if (colorGroup) updateData.colorGroup = colorGroup;

        if (idCardUrl !== undefined) updateData.idCardUrl = idCardUrl;
        if (medicalPlanUrl !== undefined) updateData.medicalPlanUrl = medicalPlanUrl;
        if (medicareCardUrl !== undefined) updateData.medicareCardUrl = medicareCardUrl;
        if (photoUrl !== undefined) updateData.photoUrl = photoUrl;

        // FASE 82 — campos nuevos
        if (ssnLastFour !== undefined) {
            // Sanitización: solo 4 dígitos
            const sanitized = (ssnLastFour || '').replace(/\D/g, '').slice(0, 4);
            updateData.ssnLastFour = sanitized || null;
        }
        if (insurancePlanName !== undefined) updateData.insurancePlanName = insurancePlanName || null;
        if (insurancePolicyNumber !== undefined) updateData.insurancePolicyNumber = insurancePolicyNumber || null;
        if (preferredHospital !== undefined) updateData.preferredHospital = preferredHospital || null;

        // FASE 84 — dirección previa
        if (address !== undefined) updateData.address = address || null;
        if (needsDialysis !== undefined) updateData.needsDialysis = Boolean(needsDialysis);

        // Capa de congruencia — modalidad de cuidado.
        // Si tocamos modalidad o hospice, exigimos rol ADMIN/DIRECTOR/NURSE
        // (decisión clínica con impacto familiar).
        const touchesModality = careModality !== undefined || hospiceProvider !== undefined || hospiceStartDate !== undefined;
        if (touchesModality) {
            const session = await getServerSession(authOptions);
            const role = (session?.user as any)?.role;
            if (!session || !['DIRECTOR', 'ADMIN', 'NURSE'].includes(role)) {
                return NextResponse.json({ success: false, error: 'Solo enfermería, dirección o admin pueden cambiar la modalidad de cuidado.' }, { status: 403 });
            }
        }

        const VALID_MODALITY = ['NONE', 'PALLIATIVE', 'HOSPICE'];
        if (careModality !== undefined) {
            if (!VALID_MODALITY.includes(careModality)) {
                return NextResponse.json({ success: false, error: `careModality inválido: ${careModality}` }, { status: 400 });
            }
            updateData.careModality = careModality;
            // Si se quita HOSPICE, limpiamos los datos asociados para no dejar
            // un nombre de hospicio fantasma cuando ya no aplica.
            if (careModality !== 'HOSPICE') {
                updateData.hospiceProvider = null;
                updateData.hospiceStartDate = null;
            }
        }
        if (hospiceProvider !== undefined) {
            // string libre del nombre de la agencia; null limpia.
            const trimmed = typeof hospiceProvider === 'string' ? hospiceProvider.trim() : '';
            updateData.hospiceProvider = trimmed || null;
        }
        if (hospiceStartDate !== undefined) {
            if (hospiceStartDate === null || hospiceStartDate === '') {
                updateData.hospiceStartDate = null;
            } else {
                const d = new Date(hospiceStartDate);
                if (isNaN(d.getTime())) {
                    return NextResponse.json({ success: false, error: `hospiceStartDate inválida` }, { status: 400 });
                }
                updateData.hospiceStartDate = d;
            }
        }

        // Sprint P — Admisión Unificada
        if (idNumber !== undefined) updateData.idNumber = idNumber || null;
        if (medicareNumber !== undefined) updateData.medicareNumber = medicareNumber || null;
        if (medicaidNumber !== undefined) updateData.medicaidNumber = medicaidNumber || null;
        if (primaryFamilyMemberId !== undefined) {
            // Si se está marcando un familiar primario, validar que pertenece a este residente
            if (primaryFamilyMemberId) {
                const fm = await prisma.familyMember.findUnique({
                    where: { id: primaryFamilyMemberId },
                    select: { patientId: true },
                });
                if (!fm || fm.patientId !== id) {
                    return NextResponse.json({ success: false, error: 'Familiar no pertenece a este residente' }, { status: 400 });
                }
            }
            updateData.primaryFamilyMemberId = primaryFamilyMemberId || null;
        }

        // IntakeData solo se toca si vienen allergies o diagnoses en el body
        if (allergies !== undefined || diagnoses !== undefined) {
            if (patient.intakeData) {
                updateData.intakeData = {
                    update: {
                        ...(allergies !== undefined ? { allergies } : {}),
                        ...(diagnoses !== undefined ? { diagnoses } : {}),
                    }
                };
            } else {
                updateData.intakeData = {
                    create: {
                        allergies: allergies || '',
                        diagnoses: diagnoses || '',
                        medicalHistory: '',
                        rawMedications: ''
                    }
                };
            }
        }

        const updated = await prisma.patient.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, patient: updated });
    } catch (error: any) {
        console.error("Update Patient Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "No autorizado para cambiar el grupo de color." }, { status: 403 });
        }

        const { id } = await params;
        const { colorGroup } = await req.json();

        const validGroups = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'UNASSIGNED'];
        if (!colorGroup || !validGroups.includes(colorGroup)) {
            return NextResponse.json({ success: false, error: "Grupo de color invalido." }, { status: 400 });
        }

        const updated = await prisma.patient.update({
            where: { id },
            data: { colorGroup }
        });

        return NextResponse.json({ success: true, patient: updated });
    } catch (error: any) {
        console.error("Patch ColorGroup Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
