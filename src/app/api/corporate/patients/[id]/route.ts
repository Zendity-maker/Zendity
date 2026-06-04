import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';

/**
 * HIPAA — Expediente del residente. GET/PUT estaban SIN auth (cualquiera
 * leía o MODIFICABA el expediente médico-legal completo). Restringido a
 * personal clínico/administrativo + tenant check, replicando el patrón del
 * endpoint hermano reports/route.ts.
 */
const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

async function getPatientHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;

        const { id } = await params;

        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                headquarters: true,
                lifePlans: { orderBy: { createdAt: 'desc' }, take: 1 },
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

        // Tenant check HIPAA — solo residentes de tu sede
        if (patient.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
        }

        return NextResponse.json({ success: true, patient });

    } catch (error) {
        console.error("Fetch Patient Error:", error);
        return NextResponse.json({ success: false, error: "Error detallando paciente." }, { status: 500 });
    }
}

// PHI access logging (HIPAA Pilar 1). El handler conserva su lógica intacta;
// el wrapper solo audita la lectura del expediente del residente.
export const GET = withPhiAccessLog(getPatientHandler, {
    resourceType: 'Patient',
    getPatientId: async ({ params }) => (await params).id,
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;

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
        } = body;

        const patient = await prisma.patient.findUnique({ where: { id }, include: { intakeData: true } });
        if (!patient) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });
        // Tenant check HIPAA — no permitir modificar el expediente de otra sede
        if (patient.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
        }

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

        // Tenant check HIPAA — no permitir cambiar colorGroup de un residente de otra sede
        const owner = await prisma.patient.findUnique({ where: { id }, select: { headquartersId: true } });
        if (!owner || owner.headquartersId !== (session.user as any).headquartersId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
        }

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
