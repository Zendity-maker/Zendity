-- ═══════════════════════════════════════════════════════════════════════
-- PUESTA AL DÍA DEL HISTORIAL — mayo a septiembre de 2026
--
-- ESTE FICHERO NUNCA SE EJECUTÓ CONTRA PRODUCCIÓN, Y NO DEBE EJECUTARSE.
-- Se marcó como aplicado con `prisma migrate resolve --applied` el
-- 22-sep-2026, porque la base YA estaba en este estado.
--
-- POR QUÉ EXISTE
--
-- Tras el force-reset del 20-may-2026 se creó un baseline
-- (20260521215210_baseline_post_force_reset) y desde entonces TODOS los
-- cambios de esquema se aplicaron con `prisma db push`, que no escribe
-- migraciones. Resultado medido el 22-sep-2026:
--
--     baseline .................  93 CREATE TABLE
--     schema.prisma de hoy ..... 113 modelos
--     tablas en la base ........ 114
--
-- Veintiuna tablas creadas en cuatro meses no estaban en el historial:
-- FamilyVisitPatient, VisitanteAutorizado, PatientCredit, MonthlyExpense,
-- MonthlyGrowthSnapshot, CRMLeadStageEvent, PhiAccessLog, DailyDigest,
-- ExternalServiceCategory, ExternalProvider, ExternalServiceVisit,
-- ExternalServiceVisitPatient, ExternalKioskDevice, SWFormTemplate,
-- SWEvaluation, SWEvaluationAddendum, FamilyContactLog, AcuerdoSede,
-- SedeVinculo, CambioDeCondicion y HallazgoZendi.
--
-- EL PELIGRO QUE ESTO QUITA
--
-- `prisma migrate dev` no compara contra la base: reproduce el historial
-- en una base sombra y compara ESO. Con el historial 21 tablas por
-- detrás, habría detectado drift y propuesto un RESET — exactamente el
-- comando que el 20-may-2026 borró la producción entera y del que nació
-- el baseline de arriba.
--
-- Y `prisma migrate status` decía "Database schema is up to date!", que
-- solo significa que las migraciones del directorio están aplicadas: NO
-- detecta drift contra el datamodel. Fiarse de esa línea llevaba derecho
-- al reset.
--
-- CÓMO SE CALCULÓ, Y CÓMO SE VALIDÓ
--
-- Sin postgres local ni Docker no había base sombra, así que el delta se
-- sacó del datamodel de mayo recuperado de git (commit eafe5a7d, el que
-- creó el baseline):
--
--     prisma migrate diff \
--       --from-schema-datamodel <schema.prisma de eafe5a7d> \
--       --to-url <producción> --script
--
-- Validado antes de usarlo: ese datamodel genera exactamente las mismas
-- 93 CREATE TABLE que el baseline del repo (diff vacío), así que
-- baseline + este fichero == la base de hoy.
--
-- El `DROP TABLE "SpecialistVisit"` de más abajo es correcto y no es un
-- error: esa tabla existía en mayo, se retiró después, y no está ni en la
-- base ni en schema.prisma. Comprobado contra information_schema.
--
-- DE AQUÍ EN ADELANTE: los cambios de esquema deberían ir por migración,
-- no por `db push`. Si vuelve a haber drift, esta trampa vuelve.
-- ═══════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "AbsenceReason" AS ENUM ('SICK', 'FAMILY_EMERGENCY', 'MEDICAL_APPOINTMENT', 'PERSONAL', 'NO_SHOW', 'OTHER', 'PENDIENTE_CONFIRMAR');

-- CreateEnum
CREATE TYPE "CareModality" AS ENUM ('NONE', 'PALLIATIVE', 'HOSPICE');

-- CreateEnum
CREATE TYPE "DietTexture" AS ENUM ('REGULAR', 'BLANDA', 'MAJADA', 'PUREE', 'LICUADO', 'LIQUIDOS_CLAROS', 'PEG');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('PAYROLL', 'RENT', 'FOOD', 'UTILITIES', 'SUPPLIES', 'INSURANCE', 'MAINTENANCE', 'PROFESSIONAL_FEES', 'OTHER');

-- CreateEnum
CREATE TYPE "ExternalVisitStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PatientCreditSource" AS ENUM ('ADVANCE_PAYMENT', 'OVERPAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PhiAccessAction" AS ENUM ('READ', 'WRITE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT', 'FAILED_AUTH', 'MFA_CHALLENGE', 'PERMISSION_CHANGE', 'DISCLOSURE');

-- CreateEnum
CREATE TYPE "SWEvaluationStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'COORDINATOR';
ALTER TYPE "Role" ADD VALUE 'HR_MANAGER';

-- AlterEnum
ALTER TYPE "IncidentType" ADD VALUE 'MEDICATION_ERROR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'APPROVED';
ALTER TYPE "OrderStatus" ADD VALUE 'REJECTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "AppointmentStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "ShiftType" ADD VALUE 'OFF';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'FAMILY_VIDEO_CALL';
ALTER TYPE "EventType" ADD VALUE 'FAMILY_PHONE_CALL';

-- AlterEnum
ALTER TYPE "LeaveType" ADD VALUE 'FALLECIMIENTO_REPORTADO';

-- AlterEnum
ALTER TYPE "SystemAuditAction" ADD VALUE 'PATIENT_PROTOCOL_CHANGED';

-- DropForeignKey
ALTER TABLE "ShiftColorAssignment" DROP CONSTRAINT "ShiftColorAssignment_scheduledShiftId_fkey";

-- DropForeignKey
ALTER TABLE "MedicationAdministration" DROP CONSTRAINT "MedicationAdministration_administeredById_fkey";

-- DropForeignKey
ALTER TABLE "SpecialistVisit" DROP CONSTRAINT "SpecialistVisit_patientId_fkey";

-- DropForeignKey
ALTER TABLE "SpecialistVisit" DROP CONSTRAINT "SpecialistVisit_createdById_fkey";

-- DropForeignKey
ALTER TABLE "SpecialistVisit" DROP CONSTRAINT "SpecialistVisit_headquartersId_fkey";

-- AlterTable
ALTER TABLE "Headquarters" ADD COLUMN     "address" TEXT,
ADD COLUMN     "brandAccent" TEXT,
ADD COLUMN     "brandBg" TEXT,
ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "brandPrimary" TEXT,
ADD COLUMN     "brandSecondary" TEXT,
ADD COLUMN     "colorFloorMap" JSONB,
ADD COLUMN     "familyWhatsAppNumber" TEXT,
ADD COLUMN     "horarioVisitas" JSONB,
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "collegiateNumber" TEXT,
ADD COLUMN     "masterCertCode" TEXT,
ADD COLUMN     "masterCertIssuedAt" TIMESTAMP(3),
ADD COLUMN     "masterCertRevokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ScheduledShift" ADD COLUMN     "absenceNotes" TEXT,
ADD COLUMN     "absenceNotified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "absenceReason" "AbsenceReason",
ADD COLUMN     "absentClearedAt" TIMESTAMP(3),
ADD COLUMN     "absentClearedById" TEXT,
ADD COLUMN     "isFloorSupervision" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "releasedById" TEXT,
ADD COLUMN     "releasedReason" TEXT;

-- AlterTable
ALTER TABLE "FamilyVisit" ADD COLUMN     "autorizadaPorId" TEXT,
ADD COLUMN     "departedAt" TIMESTAMP(3),
ADD COLUMN     "entidad" TEXT,
ADD COLUMN     "fueraDeHorario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "futuroResidente" TEXT,
ADD COLUMN     "profesion" TEXT,
ADD COLUMN     "retenida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salidaCerradaAt" TIMESTAMP(3),
ADD COLUMN     "salidaCerradaPorId" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'FAMILIAR',
ADD COLUMN     "visitorEmail" TEXT,
ADD COLUMN     "visitorPhone" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "birthCity" TEXT,
ADD COLUMN     "careModality" "CareModality" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "dietDiabetic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dietLowSodium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dietPegKcalMl" DOUBLE PRECISION,
ADD COLUMN     "dietRenal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dietTexture" "DietTexture",
ADD COLUMN     "dietVegetarian" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fallecimientoNota" TEXT,
ADD COLUMN     "fallecimientoReportadoAt" TIMESTAMP(3),
ADD COLUMN     "fallecimientoReportadoPorId" TEXT,
ADD COLUMN     "familyShareLevel" TEXT NOT NULL DEFAULT 'LIFESTYLE',
ADD COLUMN     "hospiceProvider" TEXT,
ADD COLUMN     "hospiceStartDate" TIMESTAMP(3),
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "requiresPosturalChanges" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sinFamiliarConocido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sinFamiliarMarcadoAt" TIMESTAMP(3),
ADD COLUMN     "sinFamiliarMarcadoPorId" TEXT,
ADD COLUMN     "sinFamiliarMotivo" TEXT,
ADD COLUMN     "visitasRestringidas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visitasRestringidasMotivo" TEXT;

-- AlterTable
ALTER TABLE "PatientMedication" ADD COLUMN     "scheduleDays" INTEGER[];

-- AlterTable
ALTER TABLE "MedicationAdministration" ADD COLUMN     "prnEfecto" TEXT,
ADD COLUMN     "prnEfectoAt" TIMESTAMP(3),
ADD COLUMN     "prnEfectoPorId" TEXT,
ADD COLUMN     "prnMotivo" TEXT,
ALTER COLUMN "administeredById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "reportedById" TEXT,
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN     "isLegalGuardian" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FamilySurvey" ADD COLUMN     "comentario" TEXT,
ADD COLUMN     "comentarioCuidado" TEXT,
ADD COLUMN     "comentarioLimpieza" TEXT,
ADD COLUMN     "comentarioSalud" TEXT,
ADD COLUMN     "cuidadorFavoritoId" TEXT,
ADD COLUMN     "periodo" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "token" TEXT,
ALTER COLUMN "ratingCare" DROP NOT NULL,
ALTER COLUMN "ratingClean" DROP NOT NULL,
ALTER COLUMN "ratingHealth" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PressureUlcer" ADD COLUMN     "planActualizadoAt" TIMESTAMP(3),
ADD COLUMN     "planEstablecidoPor" TEXT,
ADD COLUMN     "planTratamiento" TEXT;

-- AlterTable
ALTER TABLE "UlcerLog" ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'CURACION',
ALTER COLUMN "treatmentApplied" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PosturalChangeLog" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "esImputable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserCourse" ADD COLUMN     "certificateCode" TEXT,
ADD COLUMN     "certificateExpiresAt" TIMESTAMP(3),
ADD COLUMN     "certificateIssuedAt" TIMESTAMP(3),
ADD COLUMN     "certificateRevokedAt" TIMESTAMP(3),
ADD COLUMN     "certificateRevokedReason" TEXT;

-- AlterTable
ALTER TABLE "VitalSigns" ADD COLUMN     "weight" DOUBLE PRECISION,
ALTER COLUMN "systolic" DROP NOT NULL,
ALTER COLUMN "diastolic" DROP NOT NULL,
ALTER COLUMN "temperature" DROP NOT NULL,
ALTER COLUMN "heartRate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DailyLog" ADD COLUMN     "occurredAt" TIMESTAMP(3),
ALTER COLUMN "foodIntake" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ConciergeOrder" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "invoiceItemId" TEXT,
ADD COLUMN     "invoicedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT;

-- AlterTable
ALTER TABLE "ConciergeAppointment" ADD COLUMN     "agreedPrice" DOUBLE PRECISION,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "invoiceItemId" TEXT,
ADD COLUMN     "invoicedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "servicioExterno" TEXT;

-- AlterTable
ALTER TABLE "InvoicePayment" ADD COLUMN     "patientCreditId" TEXT;

-- AlterTable
ALTER TABLE "FallIncident" ADD COLUMN     "reportedById" TEXT,
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "ShiftSession" ADD COLUMN     "censoInicial" JSONB;

-- AlterTable
ALTER TABLE "BathLog" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MealLog" ADD COLUMN     "aceptoEnCambio" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "motivoRechazo" TEXT;

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "planteadoPorNombre" TEXT,
ADD COLUMN     "planteadoPorResidente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registradoPorId" TEXT;

-- AlterTable
ALTER TABLE "IncidentReport" ADD COLUMN     "acknowledgeRefusedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgeRefusedReason" TEXT,
ADD COLUMN     "appealOutcome" TEXT,
ADD COLUMN     "appealResolvedAt" TIMESTAMP(3),
ADD COLUMN     "appealResolvedById" TEXT,
ADD COLUMN     "appealResponseText" TEXT,
ADD COLUMN     "notifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClinicalNote" ADD COLUMN     "occurredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TriageTicket" ADD COLUMN     "title" TEXT;

-- DropTable
DROP TABLE "SpecialistVisit";

-- CreateTable
CREATE TABLE "AcuerdoSede" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "contenidoHash" TEXT NOT NULL,
    "aceptadoEn" TIMESTAMP(3),
    "aceptadoPorId" TEXT,
    "firmanteNombre" TEXT,
    "firmanteCargo" TEXT,
    "aceptadoIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcuerdoSede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRMLeadStageEvent" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL,
    "fromStage" "LeadStage",
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "CRMLeadStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioDeCondicion" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reportadoPorId" TEXT NOT NULL,
    "reportadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "area" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "revisadoPorId" TEXT,
    "revisadoAt" TIMESTAMP(3),
    "resultado" TEXT,
    "respuesta" TEXT,

    CONSTRAINT "CambioDeCondicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDigest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "digestDate" TIMESTAMP(3) NOT NULL,
    "narrative" TEXT NOT NULL,
    "foodBand" TEXT,
    "activityNote" TEXT,
    "medsOnTrack" BOOLEAN,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalKioskDevice" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "purpose" TEXT NOT NULL DEFAULT 'EXTERNAL_KIOSK',

    CONSTRAINT "ExternalKioskDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalProvider" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalServiceCategory" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalServiceVisit" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceType" TEXT,
    "comment" TEXT,
    "isFacilityWide" BOOLEAN NOT NULL DEFAULT false,
    "notifyFamilies" BOOLEAN NOT NULL DEFAULT true,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredFromFloor" INTEGER,
    "deviceTokenId" TEXT,
    "status" "ExternalVisitStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "autoPublished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExternalServiceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalServiceVisitPatient" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,

    CONSTRAINT "ExternalServiceVisitPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyContactLog" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "loggedById" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "purpose" TEXT,
    "outcome" TEXT,
    "note" TEXT,
    "durationMin" INTEGER,
    "coordinatedAppointment" BOOLEAN NOT NULL DEFAULT false,
    "linkedAppointmentId" TEXT,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyVisitPatient" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,

    CONSTRAINT "FamilyVisitPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallazgoZendi" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "patientId" TEXT,
    "resumen" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "fuente" TEXT,
    "sugerencia" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "revisadoPorId" TEXT,
    "revisadoAt" TIMESTAMP(3),
    "nota" TEXT,
    "huella" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallazgoZendi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyExpense" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyGrowthSnapshot" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "prospects" INTEGER NOT NULL DEFAULT 0,
    "tours" INTEGER NOT NULL DEFAULT 0,
    "evaluations" INTEGER NOT NULL DEFAULT 0,
    "contracts" INTEGER NOT NULL DEFAULT 0,
    "admissions" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyGrowthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCredit" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "appliedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "source" "PatientCreditSource" NOT NULL DEFAULT 'ADVANCE_PAYMENT',
    "reason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhiAccessLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "PhiAccessAction" NOT NULL,
    "userId" TEXT,
    "userRole" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "patientId" TEXT,
    "hqId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "routePath" TEXT,
    "context" JSONB,

    CONSTRAINT "PhiAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SWEvaluation" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "status" "SWEvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "data" JSONB NOT NULL,
    "prefillSnapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "signatureBase64" TEXT,
    "signerName" TEXT,
    "signerCollegiateNumber" TEXT,

    CONSTRAINT "SWEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SWEvaluationAddendum" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureBase64" TEXT,

    CONSTRAINT "SWEvaluationAddendum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SWFormTemplate" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SWFormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SedeVinculo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'INVERSIONISTA',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SedeVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitanteAutorizado" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "relacion" TEXT,
    "telefono" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadoPorId" TEXT,
    "revocadoAt" TIMESTAMP(3),
    "tipo" TEXT NOT NULL DEFAULT 'AUTORIZADO',

    CONSTRAINT "VisitanteAutorizado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcuerdoSede_headquartersId_aceptadoEn_idx" ON "AcuerdoSede"("headquartersId" ASC, "aceptadoEn" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AcuerdoSede_headquartersId_tipo_version_key" ON "AcuerdoSede"("headquartersId" ASC, "tipo" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "CRMLeadStageEvent_headquartersId_occurredAt_idx" ON "CRMLeadStageEvent"("headquartersId" ASC, "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "CRMLeadStageEvent_leadId_occurredAt_idx" ON "CRMLeadStageEvent"("leadId" ASC, "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "CambioDeCondicion_headquartersId_revisadoAt_reportadoAt_idx" ON "CambioDeCondicion"("headquartersId" ASC, "revisadoAt" ASC, "reportadoAt" ASC);

-- CreateIndex
CREATE INDEX "CambioDeCondicion_patientId_reportadoAt_idx" ON "CambioDeCondicion"("patientId" ASC, "reportadoAt" ASC);

-- CreateIndex
CREATE INDEX "DailyDigest_patientId_digestDate_idx" ON "DailyDigest"("patientId" ASC, "digestDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DailyDigest_patientId_digestDate_key" ON "DailyDigest"("patientId" ASC, "digestDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalKioskDevice_deviceToken_key" ON "ExternalKioskDevice"("deviceToken" ASC);

-- CreateIndex
CREATE INDEX "ExternalKioskDevice_headquartersId_isActive_idx" ON "ExternalKioskDevice"("headquartersId" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "ExternalProvider_categoryId_idx" ON "ExternalProvider"("categoryId" ASC);

-- CreateIndex
CREATE INDEX "ExternalProvider_headquartersId_isActive_idx" ON "ExternalProvider"("headquartersId" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalProvider_headquartersId_name_key" ON "ExternalProvider"("headquartersId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "ExternalServiceCategory_headquartersId_displayOrder_idx" ON "ExternalServiceCategory"("headquartersId" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalServiceCategory_headquartersId_name_key" ON "ExternalServiceCategory"("headquartersId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "ExternalServiceVisit_headquartersId_registeredAt_idx" ON "ExternalServiceVisit"("headquartersId" ASC, "registeredAt" ASC);

-- CreateIndex
CREATE INDEX "ExternalServiceVisit_headquartersId_status_idx" ON "ExternalServiceVisit"("headquartersId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ExternalServiceVisit_providerId_registeredAt_idx" ON "ExternalServiceVisit"("providerId" ASC, "registeredAt" ASC);

-- CreateIndex
CREATE INDEX "ExternalServiceVisitPatient_patientId_idx" ON "ExternalServiceVisitPatient"("patientId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalServiceVisitPatient_visitId_patientId_key" ON "ExternalServiceVisitPatient"("visitId" ASC, "patientId" ASC);

-- CreateIndex
CREATE INDEX "FamilyContactLog_familyMemberId_contactedAt_idx" ON "FamilyContactLog"("familyMemberId" ASC, "contactedAt" ASC);

-- CreateIndex
CREATE INDEX "FamilyContactLog_headquartersId_contactedAt_idx" ON "FamilyContactLog"("headquartersId" ASC, "contactedAt" ASC);

-- CreateIndex
CREATE INDEX "FamilyContactLog_loggedById_contactedAt_idx" ON "FamilyContactLog"("loggedById" ASC, "contactedAt" ASC);

-- CreateIndex
CREATE INDEX "FamilyContactLog_patientId_contactedAt_idx" ON "FamilyContactLog"("patientId" ASC, "contactedAt" ASC);

-- CreateIndex
CREATE INDEX "FamilyVisitPatient_patientId_idx" ON "FamilyVisitPatient"("patientId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyVisitPatient_visitId_patientId_key" ON "FamilyVisitPatient"("visitId" ASC, "patientId" ASC);

-- CreateIndex
CREATE INDEX "HallazgoZendi_headquartersId_estado_createdAt_idx" ON "HallazgoZendi"("headquartersId" ASC, "estado" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HallazgoZendi_headquartersId_huella_key" ON "HallazgoZendi"("headquartersId" ASC, "huella" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyExpense_headquartersId_periodMonth_category_key" ON "MonthlyExpense"("headquartersId" ASC, "periodMonth" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "MonthlyExpense_headquartersId_periodMonth_idx" ON "MonthlyExpense"("headquartersId" ASC, "periodMonth" ASC);

-- CreateIndex
CREATE INDEX "MonthlyGrowthSnapshot_headquartersId_periodMonth_idx" ON "MonthlyGrowthSnapshot"("headquartersId" ASC, "periodMonth" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyGrowthSnapshot_headquartersId_periodMonth_key" ON "MonthlyGrowthSnapshot"("headquartersId" ASC, "periodMonth" ASC);

-- CreateIndex
CREATE INDEX "PatientCredit_headquartersId_patientId_idx" ON "PatientCredit"("headquartersId" ASC, "patientId" ASC);

-- CreateIndex
CREATE INDEX "PatientCredit_patientId_receivedAt_idx" ON "PatientCredit"("patientId" ASC, "receivedAt" ASC);

-- CreateIndex
CREATE INDEX "PhiAccessLog_action_timestamp_idx" ON "PhiAccessLog"("action" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "PhiAccessLog_hqId_timestamp_idx" ON "PhiAccessLog"("hqId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "PhiAccessLog_patientId_timestamp_idx" ON "PhiAccessLog"("patientId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "PhiAccessLog_resourceType_timestamp_idx" ON "PhiAccessLog"("resourceType" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "PhiAccessLog_userId_timestamp_idx" ON "PhiAccessLog"("userId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "SWEvaluation_headquartersId_status_idx" ON "SWEvaluation"("headquartersId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "SWEvaluation_patientId_status_idx" ON "SWEvaluation"("patientId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "SWEvaluationAddendum_evaluationId_idx" ON "SWEvaluationAddendum"("evaluationId" ASC);

-- CreateIndex
CREATE INDEX "SWFormTemplate_headquartersId_isActive_idx" ON "SWFormTemplate"("headquartersId" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "SedeVinculo_headquartersId_idx" ON "SedeVinculo"("headquartersId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SedeVinculo_userId_headquartersId_tipo_key" ON "SedeVinculo"("userId" ASC, "headquartersId" ASC, "tipo" ASC);

-- CreateIndex
CREATE INDEX "SedeVinculo_userId_idx" ON "SedeVinculo"("userId" ASC);

-- CreateIndex
CREATE INDEX "VisitanteAutorizado_headquartersId_idx" ON "VisitanteAutorizado"("headquartersId" ASC);

-- CreateIndex
CREATE INDEX "VisitanteAutorizado_patientId_activo_tipo_idx" ON "VisitanteAutorizado"("patientId" ASC, "activo" ASC, "tipo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_masterCertCode_key" ON "User"("masterCertCode" ASC);

-- CreateIndex
CREATE INDEX "ScheduledShift_userId_date_releasedAt_idx" ON "ScheduledShift"("userId" ASC, "date" ASC, "releasedAt" ASC);

-- CreateIndex
CREATE INDEX "FamilyVisit_headquartersId_departedAt_idx" ON "FamilyVisit"("headquartersId" ASC, "departedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FamilySurvey_familyMemberId_periodo_key" ON "FamilySurvey"("familyMemberId" ASC, "periodo" ASC);

-- CreateIndex
CREATE INDEX "FamilySurvey_headquartersId_periodo_idx" ON "FamilySurvey"("headquartersId" ASC, "periodo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FamilySurvey_token_key" ON "FamilySurvey"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserCourse_certificateCode_key" ON "UserCourse"("certificateCode" ASC);

-- CreateIndex
CREATE INDEX "InvoicePayment_patientCreditId_idx" ON "InvoicePayment"("patientCreditId" ASC);

-- AddForeignKey
ALTER TABLE "AcuerdoSede" ADD CONSTRAINT "AcuerdoSede_aceptadoPorId_fkey" FOREIGN KEY ("aceptadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcuerdoSede" ADD CONSTRAINT "AcuerdoSede_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMLeadStageEvent" ADD CONSTRAINT "CRMLeadStageEvent_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMLeadStageEvent" ADD CONSTRAINT "CRMLeadStageEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CRMLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioDeCondicion" ADD CONSTRAINT "CambioDeCondicion_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioDeCondicion" ADD CONSTRAINT "CambioDeCondicion_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDigest" ADD CONSTRAINT "DailyDigest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalKioskDevice" ADD CONSTRAINT "ExternalKioskDevice_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalProvider" ADD CONSTRAINT "ExternalProvider_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExternalServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalProvider" ADD CONSTRAINT "ExternalProvider_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceCategory" ADD CONSTRAINT "ExternalServiceCategory_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceVisit" ADD CONSTRAINT "ExternalServiceVisit_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceVisit" ADD CONSTRAINT "ExternalServiceVisit_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ExternalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceVisit" ADD CONSTRAINT "ExternalServiceVisit_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceVisitPatient" ADD CONSTRAINT "ExternalServiceVisitPatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalServiceVisitPatient" ADD CONSTRAINT "ExternalServiceVisitPatient_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ExternalServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyContactLog" ADD CONSTRAINT "FamilyContactLog_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyContactLog" ADD CONSTRAINT "FamilyContactLog_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyContactLog" ADD CONSTRAINT "FamilyContactLog_linkedAppointmentId_fkey" FOREIGN KEY ("linkedAppointmentId") REFERENCES "FamilyAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyContactLog" ADD CONSTRAINT "FamilyContactLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyContactLog" ADD CONSTRAINT "FamilyContactLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySurvey" ADD CONSTRAINT "FamilySurvey_cuidadorFavoritoId_fkey" FOREIGN KEY ("cuidadorFavoritoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyVisitPatient" ADD CONSTRAINT "FamilyVisitPatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyVisitPatient" ADD CONSTRAINT "FamilyVisitPatient_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "FamilyVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallazgoZendi" ADD CONSTRAINT "HallazgoZendi_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallazgoZendi" ADD CONSTRAINT "HallazgoZendi_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Headquarters" ADD CONSTRAINT "Headquarters_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_patientCreditId_fkey" FOREIGN KEY ("patientCreditId") REFERENCES "PatientCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyExpense" ADD CONSTRAINT "MonthlyExpense_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGrowthSnapshot" ADD CONSTRAINT "MonthlyGrowthSnapshot_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCredit" ADD CONSTRAINT "PatientCredit_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCredit" ADD CONSTRAINT "PatientCredit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SWEvaluation" ADD CONSTRAINT "SWEvaluation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SWEvaluation" ADD CONSTRAINT "SWEvaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SWEvaluation" ADD CONSTRAINT "SWEvaluation_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SWEvaluation" ADD CONSTRAINT "SWEvaluation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SWEvaluation" ADD CONSTRAINT "SWEvaluation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SWFormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SWEvaluationAddendum" ADD CONSTRAINT "SWEvaluationAddendum_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SWEvaluationAddendum" ADD CONSTRAINT "SWEvaluationAddendum_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "SWEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SWFormTemplate" ADD CONSTRAINT "SWFormTemplate_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SedeVinculo" ADD CONSTRAINT "SedeVinculo_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SedeVinculo" ADD CONSTRAINT "SedeVinculo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftColorAssignment" ADD CONSTRAINT "ShiftColorAssignment_scheduledShiftId_fkey" FOREIGN KEY ("scheduledShiftId") REFERENCES "ScheduledShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitanteAutorizado" ADD CONSTRAINT "VisitanteAutorizado_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitanteAutorizado" ADD CONSTRAINT "VisitanteAutorizado_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

