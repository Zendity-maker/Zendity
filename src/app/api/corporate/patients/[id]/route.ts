import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { assertPatientInTenant } from '@/lib/patient-tenant';

/**
 * HIPAA — Expediente del residente. GET/PUT estaban SIN auth (cualquiera
 * leía o MODIFICABA el expediente médico-legal completo). Restringido a
 * personal clínico/administrativo + tenant check, replicando el patrón del
 * endpoint hermano reports/route.ts.
 *
 * SOCIAL_WORKER añadido SOLO a READ_ROLES — lee el expediente para
 * contextualizar su trabajo social (notas, beneficios, familia). NO está
 * en WRITE_ROLES — no edita data clínica del residente.
 */
const READ_ROLES  = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE', 'SOCIAL_WORKER', 'COORDINATOR'];
const WRITE_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

async function getPatientHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(READ_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;

        const { id } = await params;

        /**
         * Ventana del historial de medicación.
         *
         * NADA SE BORRA: esto limita lo que se LEE en esta respuesta, no lo que
         * está guardado. Las filas de MedicationAdministration se conservan
         * enteras y para siempre — nada en el código las elimina.
         *
         * POR QUE. El perfil traía TODAS las administraciones de TODOS los
         * medicamentos desde el ingreso. Medido el 28-ago-2026: el expediente
         * de Milagros J. Ortiz arrastraba 1 843 filas en una sola apertura, con
         * una media de 642 por residente, y la consulta tardaba 3.8 segundos.
         * Crece ~150 filas al día, así que cada mes abría más lento.
         *
         * Por defecto 30 días, que es lo que Andrés necesita ver al abrir un
         * expediente. La auditoría eMAR —que existe justamente para revisar el
         * histórico completo— pide ?historialCompleto=1 y lo recibe entero.
         */
        const url = new URL(req.url);
        const historialCompleto = url.searchParams.get('historialCompleto') === '1';
        const diasRaw = parseInt(url.searchParams.get('dias') ?? '30', 10);
        const diasHistorial = Number.isFinite(diasRaw) ? Math.min(3650, Math.max(1, diasRaw)) : 30;
        const desdeAdmins = new Date(Date.now() - diasHistorial * 86400000);

        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                headquarters: true,
                lifePlans: { orderBy: { createdAt: 'desc' }, take: 1 },
                // Solo los ids: el perfil necesita saber SI hay familiares para
                // el aviso de expediente sin contacto, no quienes son. Esos los
                // trae la pestaña de familia cuando se abre.
                familyMembers: { select: { id: true } },
                medications: {
                    include: {
                        medication: true,
                        administrations: {
                            ...(historialCompleto ? {} : { where: { createdAt: { gte: desdeAdmins } } }),
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

// PHI audit (Pilar 1) — escritura del expediente.
export const PUT = withPhiAccessLog(putPatientHandler, {
    resourceType: 'Patient',
    getPatientId: async ({ params }) => (await params).id,
});

async function putPatientHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(WRITE_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;

        const { id } = await params;
        const body = await req.json();
        const {
            name, roomNumber, dateOfBirth,
            allergies, diagnoses, diet, colorGroup,
            idCardUrl, medicalPlanUrl, medicareCardUrl, photoUrl,
            // FASE 82 — datos legales y de seguro
            ssnLastFour, insurancePlanName, insurancePolicyNumber, preferredHospital, monthlyFee,
            // FASE 84 — dirección previa
            address,
            // Sprint P — identificadores separados + encargado primario
            idNumber, medicareNumber, medicaidNumber, primaryFamilyMemberId,
            // Diálisis
            needsDialysis,
        } = body;

        const patientRaw = await prisma.patient.findUnique({ where: { id }, include: { intakeData: true } });
        const patient = assertPatientInTenant(patientRaw, invokerHqId);
        if (patient instanceof NextResponse) return patient;

        const updateData: any = {};

        // Solo actualizar campos que vienen definidos (no sobrescribir con undefined)
        if (name !== undefined) updateData.name = name;
        if (roomNumber !== undefined) updateData.roomNumber = roomNumber;
        /**
         * Cuota mensual. Sin ella el residente NO entra en la generación de
         * facturas — generate-month exige monthlyFee > 0.
         *
         * Medido el 01-sep-2026: cuatro ingresos de agosto sin cuota. El censo
         * de facturación imprimía 30 de 34 residentes y nadie sabía por qué:
         * los 4 que faltaban no tenían factura porque no tenían cuota, y el
         * asistente de admisión nunca la pedía. Son ~$10 499 al mes sin facturar.
         *
         * null y 0 se distinguen a propósito: "sin definir" no es "gratis".
         */
        if (monthlyFee !== undefined) {
            updateData.monthlyFee = monthlyFee === null || monthlyFee === ''
                ? null
                : Number(monthlyFee);
        }
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

// PHI audit (Pilar 1) — escritura del colorGroup.
export const PATCH = withPhiAccessLog(patchPatientHandler, {
    resourceType: 'Patient',
    getPatientId: async ({ params }) => (await params).id,
});

async function patchPatientHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "No autorizado para cambiar el grupo de color." }, { status: 403 });
        }

        const { id } = await params;

        const ownerRaw = await prisma.patient.findUnique({ where: { id }, select: { headquartersId: true } });
        const owner = assertPatientInTenant(ownerRaw, (session.user as any).headquartersId);
        if (owner instanceof NextResponse) return owner;

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
