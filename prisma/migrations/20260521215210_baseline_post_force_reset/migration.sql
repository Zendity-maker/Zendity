-- CreateEnum
CREATE TYPE "VitalsOrderStatus" AS ENUM ('PENDING', 'COMPLETED_ON_TIME', 'COMPLETED_LATE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'HQ_OWNER', 'CLINICAL_DIRECTOR', 'ADMIN', 'NURSE', 'CAREGIVER', 'SOCIAL_WORKER', 'DIRECTOR', 'THERAPIST', 'BEAUTY_SPECIALIST', 'SUPERVISOR', 'MAINTENANCE', 'KITCHEN', 'CLEANING', 'INVESTOR');

-- CreateEnum
CREATE TYPE "ColorGroup" AS ENUM ('RED', 'YELLOW', 'GREEN', 'BLUE', 'UNASSIGNED');

-- CreateEnum
CREATE TYPE "MedActiveStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'DISCONTINUED', 'PRN');

-- CreateEnum
CREATE TYPE "MedStatus" AS ENUM ('PENDING', 'ADMINISTERED', 'MISSED', 'REFUSED', 'OMITTED', 'HELD');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('FALL', 'ULCER', 'BEHAVIOR', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('FAMILY', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('LICENSE', 'INSURANCE', 'PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'WARNING');

-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('PENDING', 'PROCESSED', 'INGRESADO', 'PENDIENTE_REVISION', 'CONFIRMADO');

-- CreateEnum
CREATE TYPE "LifePlanStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ADDED', 'MODIFIED', 'DISCONTINUED', 'VERIFIED_BY_NURSE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('ADF', 'PRIVATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT', 'FULL_DAY', 'FULL_NIGHT', 'SUPERVISOR_DAY');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('PROSPECT', 'TOUR', 'EVALUATION', 'CONTRACT', 'ADMISSION');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('WHATSAPP', 'EMAIL', 'OUTBOUND_CALL');

-- CreateEnum
CREATE TYPE "SaaSStage" AS ENUM ('PROSPECTO', 'CONTACTADO', 'VISITA_AGENDADA', 'DEMO_DADA', 'PROPUESTA_ENVIADA', 'CERRADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "SaaSPriority" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "FallRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('NONE', 'MILD', 'SEVERE', 'FATAL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('LABORATORY', 'MEDICAL_VISIT', 'FAMILY_VISIT', 'ACTIVITY', 'INFRASTRUCTURE', 'CONCIERGE_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "MealQuality" AS ENUM ('ALL', 'HALF', 'LITTLE', 'NONE');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'APPROVED_ADMIN', 'ROUTED_NURSING', 'ROUTED_MAINTENANCE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'DISCHARGED', 'DECEASED', 'TEMPORARY_LEAVE');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('HOSPITAL', 'FAMILY_VISIT', 'DIALYSIS', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'SIGNED', 'VOIDED');

-- CreateEnum
CREATE TYPE "HrIncidentSeverity" AS ENUM ('OBSERVATION', 'WARNING', 'SUSPENSION', 'TERMINATION');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('PUNCTUALITY', 'PATIENT_CARE', 'HYGIENE', 'BEHAVIOR', 'DOCUMENTATION', 'UNIFORM', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('DRAFT', 'NOTIFIED', 'PENDING_EXPLANATION', 'EXPLANATION_RECEIVED', 'APPLIED', 'DISMISSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TicketOriginType" AS ENUM ('EMAR_MISS', 'DAILY_LOG', 'INCIDENT', 'COMPLAINT', 'FALL', 'CRON_SYSTEM', 'MANUAL');

-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('SLA_BREACH_120M', 'MANUAL_BY_SUPERVISOR', 'CRITICAL_INCIDENT_AUTO');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "SemaphoreColor" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "SystemAuditAction" AS ENUM ('CREATED', 'STATE_CHANGED', 'ESCALATED', 'RESOLVED', 'SIGNED_OUT', 'ACCEPTED_IN', 'SYSTEM_ABANDONED', 'VOIDED', 'AUDIT_REPORT_SENT', 'SHIFT_REDISTRIBUTE', 'MEDICATION_ADMINISTERED', 'MEDICATION_MISSED', 'MEDICATION_REFUSED', 'MEDICATION_ADDED', 'MEDICATION_MODIFIED', 'MEDICATION_DISCONTINUED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_BLOCKED', 'HANDOVER_CREATED', 'HANDOVER_ACCEPTED', 'INCIDENT_REPORTED', 'INCIDENT_REVIEWED', 'INCIDENT_CLOSED');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('MEDICAL_APPOINTMENT', 'REEVALUATION_DUE', 'THERAPY', 'FACILITY_ROUTINE');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AcademyAssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('ID_CARD', 'INSURANCE_CARD', 'MEDICARE_CARD', 'MEDICAL_RECORD', 'HOSPITAL_DISCHARGE', 'LAB_RESULT', 'PRESCRIPTION', 'POWER_OF_ATTORNEY', 'SOCIAL_WORK_NOTE', 'OTHER');

-- CreateTable
CREATE TABLE "Headquarters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "licenseActive" BOOLEAN NOT NULL DEFAULT true,
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "shiftRuleMorning" INTEGER NOT NULL DEFAULT 3,
    "shiftRuleEvening" INTEGER NOT NULL DEFAULT 3,
    "shiftRuleNight" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
    "taxId" TEXT,
    "billingAddress" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'PRO',
    "phone" TEXT,
    "logoUrl" TEXT,

    CONSTRAINT "Headquarters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pinCode" TEXT,
    "photoUrl" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "preferredShift" TEXT,
    "offDays" TEXT[],
    "complianceScore" INTEGER NOT NULL DEFAULT 75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hiredAt" TIMESTAMP(3),
    "isShiftBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "secondaryRoles" "Role"[],

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledShift" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "colorGroup" TEXT,
    "notes" TEXT,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "absentMarkedAt" TIMESTAMP(3),
    "absentMarkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "customStartTime" TIMESTAMP(3),
    "customEndTime" TIMESTAMP(3),
    "customDescription" TEXT,

    CONSTRAINT "ScheduledShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftColorAssignment" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "scheduledShiftId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "isAutoAssigned" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftColorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VitalsOrder" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderedById" TEXT NOT NULL,
    "caregiverId" TEXT,
    "reason" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "lateReason" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "status" "VitalsOrderStatus" NOT NULL DEFAULT 'PENDING',
    "autoCreated" BOOLEAN NOT NULL DEFAULT false,
    "shiftSessionId" TEXT,
    "penaltyApplied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VitalsOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyVisit" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT,
    "visitorName" TEXT NOT NULL,
    "residentName" TEXT,
    "visitorRelation" TEXT,
    "signatureData" TEXT,
    "notes" TEXT,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FamilyVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyVisitNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyVisitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "diet" TEXT,
    "avdScore" INTEGER,
    "downtonRisk" BOOLEAN NOT NULL DEFAULT false,
    "nortonRisk" BOOLEAN NOT NULL DEFAULT false,
    "colorGroup" "ColorGroup" NOT NULL DEFAULT 'UNASSIGNED',
    "conciergeBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "adfContribution" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "privateContribution" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "paymentMethod" TEXT,
    "achBankName" TEXT,
    "achAccountNumber" TEXT,
    "achRoutingNumber" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "leaveType" "LeaveType",
    "leaveDate" TIMESTAMP(3),
    "dischargeDate" TIMESTAMP(3),
    "dischargeReason" TEXT,
    "photoUrl" TEXT,
    "needsDialysis" BOOLEAN NOT NULL DEFAULT false,
    "idCardUrl" TEXT,
    "medicalPlanUrl" TEXT,
    "medicareCardUrl" TEXT,
    "ssnLastFour" TEXT,
    "insurancePlanName" TEXT,
    "insurancePolicyNumber" TEXT,
    "preferredHospital" TEXT,
    "address" TEXT,
    "medicareNumber" TEXT,
    "medicaidNumber" TEXT,
    "idNumber" TEXT,
    "primaryFamilyMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "route" TEXT NOT NULL DEFAULT 'Oral',
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "condition" TEXT DEFAULT 'General',
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "requiresFridge" BOOLEAN NOT NULL DEFAULT false,
    "withFood" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "headquartersId" TEXT,
    "isGlobalMaster" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientMedication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'DIARIO',
    "scheduleTimes" TEXT NOT NULL,
    "prepDuration" TEXT NOT NULL DEFAULT '1_SEMANA',
    "instructions" TEXT,
    "prescribedBy" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "MedActiveStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "PatientMedication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationAdministration" (
    "id" TEXT NOT NULL,
    "patientMedicationId" TEXT NOT NULL,
    "administeredById" TEXT NOT NULL,
    "scheduledFor" TEXT,
    "scheduledTime" TIMESTAMP(3),
    "scheduleTime" TEXT,
    "administeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MedStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "signatureBase64" TEXT,

    CONSTRAINT "MedicationAdministration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'LOW',
    "description" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "biometricSignature" TEXT NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "relationship" TEXT,
    "passcode" TEXT,
    "accessLevel" TEXT NOT NULL,
    "inviteToken" TEXT,
    "inviteExpiry" TIMESTAMP(3),
    "isRegistered" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "idCardUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessDiary" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessDiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilySurvey" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "ratingCare" INTEGER NOT NULL,
    "ratingClean" INTEGER NOT NULL,
    "ratingHealth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilySurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressureUlcer" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "bodyLocation" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "PressureUlcer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UlcerLog" (
    "id" TEXT NOT NULL,
    "ulcerId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "woundSize" TEXT,
    "treatmentApplied" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasPhoto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UlcerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosturalChangeLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isComplianceAlert" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PosturalChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMessage" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageBase64" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "recipientType" TEXT DEFAULT 'ADMINISTRATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEvaluation" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "categoryScores" JSONB,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "durationMins" INTEGER NOT NULL,
    "bonusCompliance" INTEGER NOT NULL,
    "videoUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "imageUrl" TEXT,
    "emoji" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "targetRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCourse" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateDocument" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "type" "DocType" NOT NULL,
    "name" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeData" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicalHistory" TEXT,
    "allergies" TEXT,
    "diagnoses" TEXT,
    "rawMedications" TEXT,
    "mobilityLevel" TEXT,
    "continenceLevel" TEXT,
    "dietSpecifics" TEXT,
    "downtonScore" INTEGER,
    "bradenScore" INTEGER,
    "snapshotData" TEXT,
    "status" "IntakeStatus" NOT NULL DEFAULT 'INGRESADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentAnalysisNotes" TEXT,
    "zendiAnalysis" JSONB,
    "idVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "IntakeData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifePlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "LifePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "type" TEXT NOT NULL DEFAULT 'INITIAL',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "familyVersion" TEXT,
    "supportSource" TEXT,
    "clinicalSummary" TEXT,
    "continence" TEXT,
    "cognitiveLevel" TEXT,
    "mobility" TEXT,
    "dietDetails" TEXT,
    "risks" JSONB,
    "interdisciplinarySummary" TEXT,
    "goals" JSONB,
    "familyEducation" TEXT,
    "preferences" TEXT,
    "monitoringMethod" TEXT,
    "revisionCriteria" TEXT,
    "recommendedServices" JSONB,
    "startDate" TIMESTAMP(3),
    "nextReview" TIMESTAMP(3),
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "signatureBase64" TEXT,
    "signatureIpAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VitalSigns" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "measuredById" TEXT NOT NULL,
    "systolic" INTEGER NOT NULL,
    "diastolic" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "heartRate" INTEGER NOT NULL,
    "glucose" INTEGER,
    "spo2" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VitalSigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bathCompleted" BOOLEAN NOT NULL DEFAULT false,
    "foodIntake" INTEGER NOT NULL,
    "notes" TEXT,
    "isClinicalAlert" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationAuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "patientMedicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthAppointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZendiFamilyMoment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "optionGen1" TEXT NOT NULL,
    "optionGen2" TEXT NOT NULL,
    "selectedOption" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZendiFamilyMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZendiInteractionLog" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "zendiResponse" TEXT NOT NULL,
    "contextPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZendiInteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZendiNursingUpdate" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "optionGen1" TEXT NOT NULL,
    "optionGen2" TEXT NOT NULL,
    "selectedOption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZendiNursingUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightDismissal" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "dismissedById" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciergeProduct" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOffer" BOOLEAN NOT NULL DEFAULT false,
    "originalPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciergeProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciergeOrder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "orderedById" TEXT NOT NULL,
    "orderedByType" TEXT NOT NULL DEFAULT 'FAMILY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciergeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciergeService" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "providerType" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOffer" BOOLEAN NOT NULL DEFAULT false,
    "originalPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciergeService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciergeAppointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "specialistId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciergeAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "referenceNumber" TEXT,
    "receiptSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" "PaymentSource" NOT NULL DEFAULT 'PRIVATE',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftHandover" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "outgoingNurseId" TEXT,
    "incomingNurseId" TEXT,
    "status" "HandoverStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "aiSummaryReport" TEXT,
    "audioUrl" TEXT,
    "signature" TEXT,
    "signedOutAt" TIMESTAMP(3),
    "justifications" JSONB,
    "handoverCompleted" BOOLEAN NOT NULL DEFAULT false,
    "colorGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDailyPrologue" BOOLEAN NOT NULL DEFAULT false,
    "supervisorSignedById" TEXT,
    "supervisorSignedAt" TIMESTAMP(3),
    "supervisorSignature" TEXT,
    "supervisorNote" TEXT,
    "directorViewedAt" TIMESTAMP(3),

    CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverNote" (
    "id" TEXT NOT NULL,
    "shiftHandoverId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicalNotes" TEXT NOT NULL,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HandoverNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HqIntegration" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "vapiApiKey" TEXT,
    "twilioApiKey" TEXT,
    "sendgridApiKey" TEXT,
    "docusignApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HqIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRMLead" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'PROSPECT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "medicalEvaluationCompleted" BOOLEAN NOT NULL DEFAULT false,
    "contractSigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CRMLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITranscript" (
    "id" TEXT NOT NULL,
    "crmLeadId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "transcriptText" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AITranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionLog" (
    "id" TEXT NOT NULL,
    "crmLeadId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaaSProspect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "contactName" TEXT,
    "stage" "SaaSStage" NOT NULL DEFAULT 'PROSPECTO',
    "priority" "SaaSPriority" NOT NULL DEFAULT 'ALTA',
    "estimatedBeds" INTEGER,
    "planInterest" TEXT,
    "notes" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedToId" TEXT,

    CONSTRAINT "SaaSProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaaSContract" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "pricePerBed" DOUBLE PRECISION NOT NULL,
    "beds" INTEGER NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaaSContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FallRiskAssessment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "riskLevel" "FallRiskLevel" NOT NULL DEFAULT 'LOW',
    "morseScore" INTEGER,
    "factors" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReviewAt" TIMESTAMP(3),

    CONSTRAINT "FallRiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FallIncident" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MILD',
    "interventions" TEXT NOT NULL,
    "notes" TEXT,
    "incidentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FallIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeadquartersEvent" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EventType" NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT,
    "photoUrl" TEXT,
    "targetPopulation" TEXT NOT NULL DEFAULT 'ALL',
    "targetGroups" TEXT[],
    "targetPatients" TEXT[],
    "assignedToId" TEXT,
    "resolutionTimeMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeadquartersEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSchedule" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "zoneColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSession" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedEndTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "initialCensus" INTEGER,
    "leaveCensus" INTEGER NOT NULL DEFAULT 0,
    "aiSummaryReport" TEXT,
    "handoverCompleted" BOOLEAN NOT NULL DEFAULT false,
    "shiftHandoverId" TEXT,

    CONSTRAINT "ShiftSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BathLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "shiftSessionId" TEXT,
    "timeLogged" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "BathLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "shiftSessionId" TEXT,
    "mealType" "MealType" NOT NULL,
    "quality" "MealQuality" NOT NULL,
    "timeLogged" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVisit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "shiftSessionId" TEXT,
    "serviceName" TEXT NOT NULL,
    "timeLogged" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "familyMemberId" TEXT,
    "patientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaaSInvoice" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaaSInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaaSInvoiceItem" (
    "id" TEXT NOT NULL,
    "saasInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SaaSInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "signatureData" TEXT,
    "ipAddress" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "patientId" TEXT,
    "familyMemberId" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenObservation" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "satisfactionScore" INTEGER NOT NULL,
    "comments" TEXT NOT NULL,
    "photoUrl" TEXT,
    "mealType" TEXT NOT NULL DEFAULT 'GENERAL',
    "feedbackType" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "portionsAdequate" BOOLEAN NOT NULL DEFAULT true,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalAnnouncement" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMenu" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "breakfast" TEXT,
    "lunch" TEXT,
    "dinner" TEXT,
    "snacks" TEXT,
    "supervisorNotes" TEXT,
    "supervisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signatureBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" "HrIncidentSeverity" NOT NULL DEFAULT 'OBSERVATION',
    "category" "IncidentCategory" NOT NULL DEFAULT 'OTHER',
    "status" "IncidentStatus" NOT NULL DEFAULT 'DRAFT',
    "pointsDeducted" INTEGER,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedSignature" TEXT,
    "employeeResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "appealText" TEXT,
    "appealedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "directorNote" TEXT,
    "visibleToEmployee" BOOLEAN NOT NULL DEFAULT false,
    "relatedPatientId" TEXT,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FastActionAssignment" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FastActionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageTicket" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT,
    "originType" "TicketOriginType" NOT NULL,
    "originReferenceId" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "isEscalated" BOOLEAN NOT NULL DEFAULT false,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "resolutionNote" TEXT,
    "followUpNotes" JSONB,
    "assignedToId" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "TriageTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAuditLog" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "SystemAuditAction" NOT NULL,
    "performedById" TEXT,
    "payloadChanges" JSONB,
    "clientIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT,
    "assignedToId" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originContext" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceScore" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "systemScore" DOUBLE PRECISION NOT NULL,
    "humanScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "systemFindings" JSONB,
    "aiReport" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyAssignment" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AcademyAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedBySystem" BOOLEAN NOT NULL DEFAULT true,
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AcademyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningArea" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "roomNumber" TEXT,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CleaningArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningLog" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "cleanedById" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "photoUrl" TEXT,
    "photoRequested" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "productsUsed" TEXT[],
    "cleanedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningRequest" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "areaId" TEXT,
    "areaName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "assignedToId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningDailyStats" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalAreas" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "uniqueAreasLogged" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningDailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialWorkNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialWorkNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialWorkTask" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FOLLOW_UP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isZendiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialWorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialWorkBenefit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "details" TEXT,
    "expirationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialWorkBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistVisit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "specialistType" TEXT NOT NULL,
    "specialistName" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "nextVisitDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneInspection" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "roundType" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "zoneName" TEXT NOT NULL,
    "checklistData" JSONB NOT NULL,
    "observations" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMessage" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DIRECT',
    "recipientId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorBriefing" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clinicalDay" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "bullets" JSONB NOT NULL,
    "generatedById" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',

    CONSTRAINT "DirectorBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftPatientOverride" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "originalColor" TEXT NOT NULL,
    "assignedColor" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "shiftType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "autoAssigned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShiftPatientOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientDocument" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "ocrText" TEXT,
    "zendiAnalysis" JSONB,
    "analyzedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyAppointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "requestedTime" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scoreBefore" INTEGER NOT NULL,
    "scoreAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZendityMessage" (
    "id" TEXT NOT NULL,
    "targetHqId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZendityMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'QUESTION',
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Schedule_headquartersId_weekStartDate_idx" ON "Schedule"("headquartersId", "weekStartDate");

-- CreateIndex
CREATE INDEX "ScheduledShift_scheduleId_date_shiftType_idx" ON "ScheduledShift"("scheduleId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "ScheduledShift_scheduleId_date_isAbsent_idx" ON "ScheduledShift"("scheduleId", "date", "isAbsent");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "VitalsOrder_patientId_status_idx" ON "VitalsOrder"("patientId", "status");

-- CreateIndex
CREATE INDEX "VitalsOrder_headquartersId_status_idx" ON "VitalsOrder"("headquartersId", "status");

-- CreateIndex
CREATE INDEX "VitalsOrder_caregiverId_status_idx" ON "VitalsOrder"("caregiverId", "status");

-- CreateIndex
CREATE INDEX "VitalsOrder_shiftSessionId_idx" ON "VitalsOrder"("shiftSessionId");

-- CreateIndex
CREATE INDEX "FamilyVisit_headquartersId_visitedAt_idx" ON "FamilyVisit"("headquartersId", "visitedAt");

-- CreateIndex
CREATE INDEX "FamilyVisitNote_patientId_visitedAt_idx" ON "FamilyVisitNote"("patientId", "visitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_primaryFamilyMemberId_key" ON "Patient"("primaryFamilyMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationAdministration_patientMedicationId_scheduledTime_key" ON "MedicationAdministration"("patientMedicationId", "scheduledTime");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_email_key" ON "FamilyMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_inviteToken_key" ON "FamilyMember"("inviteToken");

-- CreateIndex
CREATE INDEX "PosturalChangeLog_patientId_performedAt_idx" ON "PosturalChangeLog"("patientId", "performedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserCourse_employeeId_courseId_key" ON "UserCourse"("employeeId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeData_patientId_key" ON "IntakeData"("patientId");

-- CreateIndex
CREATE INDEX "LifePlan_patientId_status_idx" ON "LifePlan"("patientId", "status");

-- CreateIndex
CREATE INDEX "LifePlan_patientId_createdAt_idx" ON "LifePlan"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ZendiNursingUpdate_patientId_status_idx" ON "ZendiNursingUpdate"("patientId", "status");

-- CreateIndex
CREATE INDEX "ZendiNursingUpdate_headquartersId_idx" ON "ZendiNursingUpdate"("headquartersId");

-- CreateIndex
CREATE INDEX "InsightDismissal_employeeId_insightType_idx" ON "InsightDismissal"("employeeId", "insightType");

-- CreateIndex
CREATE INDEX "InsightDismissal_headquartersId_expiresAt_idx" ON "InsightDismissal"("headquartersId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "HqIntegration_headquartersId_key" ON "HqIntegration"("headquartersId");

-- CreateIndex
CREATE UNIQUE INDEX "SaaSContract_headquartersId_key" ON "SaaSContract"("headquartersId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftSession_shiftHandoverId_key" ON "ShiftSession"("shiftHandoverId");

-- CreateIndex
CREATE UNIQUE INDEX "SaaSInvoice_invoiceNumber_key" ON "SaaSInvoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMenu_headquartersId_date_key" ON "DailyMenu"("headquartersId", "date");

-- CreateIndex
CREATE INDEX "IncidentReport_headquartersId_status_idx" ON "IncidentReport"("headquartersId", "status");

-- CreateIndex
CREATE INDEX "IncidentReport_employeeId_status_idx" ON "IncidentReport"("employeeId", "status");

-- CreateIndex
CREATE INDEX "TriageTicket_headquartersId_status_priority_isEscalated_isV_idx" ON "TriageTicket"("headquartersId", "status", "priority", "isEscalated", "isVoided");

-- CreateIndex
CREATE INDEX "SystemAuditLog_headquartersId_entityName_entityId_idx" ON "SystemAuditLog"("headquartersId", "entityName", "entityId");

-- CreateIndex
CREATE INDEX "SystemAuditLog_createdAt_idx" ON "SystemAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_headquartersId_startTime_status_idx" ON "CalendarEvent"("headquartersId", "startTime", "status");

-- CreateIndex
CREATE INDEX "PerformanceScore_headquartersId_userId_idx" ON "PerformanceScore"("headquartersId", "userId");

-- CreateIndex
CREATE INDEX "AcademyAssignment_headquartersId_userId_moduleCode_idx" ON "AcademyAssignment"("headquartersId", "userId", "moduleCode");

-- CreateIndex
CREATE INDEX "CleaningDailyStats_headquartersId_date_idx" ON "CleaningDailyStats"("headquartersId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CleaningDailyStats_headquartersId_date_key" ON "CleaningDailyStats"("headquartersId", "date");

-- CreateIndex
CREATE INDEX "StaffMessage_headquartersId_type_createdAt_idx" ON "StaffMessage"("headquartersId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "StaffMessage_recipientId_isRead_idx" ON "StaffMessage"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "DirectorBriefing_scope_generatedAt_idx" ON "DirectorBriefing"("scope", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorBriefing_scope_clinicalDay_key" ON "DirectorBriefing"("scope", "clinicalDay");

-- CreateIndex
CREATE INDEX "ShiftPatientOverride_headquartersId_shiftDate_shiftType_idx" ON "ShiftPatientOverride"("headquartersId", "shiftDate", "shiftType");

-- CreateIndex
CREATE INDEX "ShiftPatientOverride_patientId_isActive_idx" ON "ShiftPatientOverride"("patientId", "isActive");

-- CreateIndex
CREATE INDEX "ShiftPatientOverride_caregiverId_isActive_idx" ON "ShiftPatientOverride"("caregiverId", "isActive");

-- CreateIndex
CREATE INDEX "PatientDocument_patientId_category_idx" ON "PatientDocument"("patientId", "category");

-- CreateIndex
CREATE INDEX "PatientDocument_headquartersId_idx" ON "PatientDocument"("headquartersId");

-- CreateIndex
CREATE INDEX "FamilyAppointment_patientId_status_idx" ON "FamilyAppointment"("patientId", "status");

-- CreateIndex
CREATE INDEX "FamilyAppointment_headquartersId_requestedDate_idx" ON "FamilyAppointment"("headquartersId", "requestedDate");

-- CreateIndex
CREATE INDEX "ScoreEvent_userId_createdAt_idx" ON "ScoreEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreEvent_headquartersId_createdAt_idx" ON "ScoreEvent"("headquartersId", "createdAt");

-- CreateIndex
CREATE INDEX "ZendityMessage_targetHqId_createdAt_idx" ON "ZendityMessage"("targetHqId", "createdAt");

-- CreateIndex
CREATE INDEX "ZendityMessage_authorId_createdAt_idx" ON "ZendityMessage"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_headquartersId_createdAt_idx" ON "SupportTicket"("headquartersId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_submittedById_createdAt_idx" ON "SupportTicket"("submittedById", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftColorAssignment" ADD CONSTRAINT "ShiftColorAssignment_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftColorAssignment" ADD CONSTRAINT "ShiftColorAssignment_scheduledShiftId_fkey" FOREIGN KEY ("scheduledShiftId") REFERENCES "ScheduledShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftColorAssignment" ADD CONSTRAINT "ShiftColorAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalsOrder" ADD CONSTRAINT "VitalsOrder_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalsOrder" ADD CONSTRAINT "VitalsOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalsOrder" ADD CONSTRAINT "VitalsOrder_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalsOrder" ADD CONSTRAINT "VitalsOrder_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalsOrder" ADD CONSTRAINT "VitalsOrder_shiftSessionId_fkey" FOREIGN KEY ("shiftSessionId") REFERENCES "ShiftSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyVisit" ADD CONSTRAINT "FamilyVisit_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyVisit" ADD CONSTRAINT "FamilyVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_primaryFamilyMemberId_fkey" FOREIGN KEY ("primaryFamilyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMedication" ADD CONSTRAINT "PatientMedication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMedication" ADD CONSTRAINT "PatientMedication_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_patientMedicationId_fkey" FOREIGN KEY ("patientMedicationId") REFERENCES "PatientMedication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessDiary" ADD CONSTRAINT "WellnessDiary_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessDiary" ADD CONSTRAINT "WellnessDiary_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySurvey" ADD CONSTRAINT "FamilySurvey_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySurvey" ADD CONSTRAINT "FamilySurvey_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressureUlcer" ADD CONSTRAINT "PressureUlcer_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UlcerLog" ADD CONSTRAINT "UlcerLog_ulcerId_fkey" FOREIGN KEY ("ulcerId") REFERENCES "PressureUlcer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UlcerLog" ADD CONSTRAINT "UlcerLog_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosturalChangeLog" ADD CONSTRAINT "PosturalChangeLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosturalChangeLog" ADD CONSTRAINT "PosturalChangeLog_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMessage" ADD CONSTRAINT "FamilyMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEvaluation" ADD CONSTRAINT "EmployeeEvaluation_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEvaluation" ADD CONSTRAINT "EmployeeEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEvaluation" ADD CONSTRAINT "EmployeeEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourse" ADD CONSTRAINT "UserCourse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourse" ADD CONSTRAINT "UserCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourse" ADD CONSTRAINT "UserCourse_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateDocument" ADD CONSTRAINT "CorporateDocument_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeData" ADD CONSTRAINT "IntakeData_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifePlan" ADD CONSTRAINT "LifePlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifePlan" ADD CONSTRAINT "LifePlan_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifePlan" ADD CONSTRAINT "LifePlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalSigns" ADD CONSTRAINT "VitalSigns_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalSigns" ADD CONSTRAINT "VitalSigns_measuredById_fkey" FOREIGN KEY ("measuredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAuditLog" ADD CONSTRAINT "MedicationAuditLog_patientMedicationId_fkey" FOREIGN KEY ("patientMedicationId") REFERENCES "PatientMedication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAuditLog" ADD CONSTRAINT "MedicationAuditLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthAppointment" ADD CONSTRAINT "HealthAppointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZendiFamilyMoment" ADD CONSTRAINT "ZendiFamilyMoment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZendiFamilyMoment" ADD CONSTRAINT "ZendiFamilyMoment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZendiInteractionLog" ADD CONSTRAINT "ZendiInteractionLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZendiNursingUpdate" ADD CONSTRAINT "ZendiNursingUpdate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZendiNursingUpdate" ADD CONSTRAINT "ZendiNursingUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZendiNursingUpdate" ADD CONSTRAINT "ZendiNursingUpdate_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightDismissal" ADD CONSTRAINT "InsightDismissal_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightDismissal" ADD CONSTRAINT "InsightDismissal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightDismissal" ADD CONSTRAINT "InsightDismissal_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeProduct" ADD CONSTRAINT "ConciergeProduct_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeOrder" ADD CONSTRAINT "ConciergeOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeOrder" ADD CONSTRAINT "ConciergeOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ConciergeProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeService" ADD CONSTRAINT "ConciergeService_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeAppointment" ADD CONSTRAINT "ConciergeAppointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeAppointment" ADD CONSTRAINT "ConciergeAppointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ConciergeService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeAppointment" ADD CONSTRAINT "ConciergeAppointment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_outgoingNurseId_fkey" FOREIGN KEY ("outgoingNurseId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_incomingNurseId_fkey" FOREIGN KEY ("incomingNurseId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_supervisorSignedById_fkey" FOREIGN KEY ("supervisorSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverNote" ADD CONSTRAINT "HandoverNote_shiftHandoverId_fkey" FOREIGN KEY ("shiftHandoverId") REFERENCES "ShiftHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverNote" ADD CONSTRAINT "HandoverNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HqIntegration" ADD CONSTRAINT "HqIntegration_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMLead" ADD CONSTRAINT "CRMLead_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITranscript" ADD CONSTRAINT "AITranscript_crmLeadId_fkey" FOREIGN KEY ("crmLeadId") REFERENCES "CRMLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionLog" ADD CONSTRAINT "InteractionLog_crmLeadId_fkey" FOREIGN KEY ("crmLeadId") REFERENCES "CRMLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaaSProspect" ADD CONSTRAINT "SaaSProspect_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaaSContract" ADD CONSTRAINT "SaaSContract_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FallRiskAssessment" ADD CONSTRAINT "FallRiskAssessment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FallRiskAssessment" ADD CONSTRAINT "FallRiskAssessment_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FallIncident" ADD CONSTRAINT "FallIncident_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeadquartersEvent" ADD CONSTRAINT "HeadquartersEvent_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeadquartersEvent" ADD CONSTRAINT "HeadquartersEvent_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeadquartersEvent" ADD CONSTRAINT "HeadquartersEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSchedule" ADD CONSTRAINT "ShiftSchedule_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSchedule" ADD CONSTRAINT "ShiftSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_shiftHandoverId_fkey" FOREIGN KEY ("shiftHandoverId") REFERENCES "ShiftHandover"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BathLog" ADD CONSTRAINT "BathLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BathLog" ADD CONSTRAINT "BathLog_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BathLog" ADD CONSTRAINT "BathLog_shiftSessionId_fkey" FOREIGN KEY ("shiftSessionId") REFERENCES "ShiftSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_shiftSessionId_fkey" FOREIGN KEY ("shiftSessionId") REFERENCES "ShiftSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_shiftSessionId_fkey" FOREIGN KEY ("shiftSessionId") REFERENCES "ShiftSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaaSInvoice" ADD CONSTRAINT "SaaSInvoice_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaaSInvoiceItem" ADD CONSTRAINT "SaaSInvoiceItem_saasInvoiceId_fkey" FOREIGN KEY ("saasInvoiceId") REFERENCES "SaaSInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenObservation" ADD CONSTRAINT "KitchenObservation_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenObservation" ADD CONSTRAINT "KitchenObservation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalAnnouncement" ADD CONSTRAINT "GlobalAnnouncement_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMenu" ADD CONSTRAINT "DailyMenu_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMenu" ADD CONSTRAINT "DailyMenu_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FastActionAssignment" ADD CONSTRAINT "FastActionAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FastActionAssignment" ADD CONSTRAINT "FastActionAssignment_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FastActionAssignment" ADD CONSTRAINT "FastActionAssignment_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageTicket" ADD CONSTRAINT "TriageTicket_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageTicket" ADD CONSTRAINT "TriageTicket_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageTicket" ADD CONSTRAINT "TriageTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageTicket" ADD CONSTRAINT "TriageTicket_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAuditLog" ADD CONSTRAINT "SystemAuditLog_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceScore" ADD CONSTRAINT "PerformanceScore_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceScore" ADD CONSTRAINT "PerformanceScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyAssignment" ADD CONSTRAINT "AcademyAssignment_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyAssignment" ADD CONSTRAINT "AcademyAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningArea" ADD CONSTRAINT "CleaningArea_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningLog" ADD CONSTRAINT "CleaningLog_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "CleaningArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningLog" ADD CONSTRAINT "CleaningLog_cleanedById_fkey" FOREIGN KEY ("cleanedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningLog" ADD CONSTRAINT "CleaningLog_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRequest" ADD CONSTRAINT "CleaningRequest_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRequest" ADD CONSTRAINT "CleaningRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRequest" ADD CONSTRAINT "CleaningRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRequest" ADD CONSTRAINT "CleaningRequest_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "CleaningArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningDailyStats" ADD CONSTRAINT "CleaningDailyStats_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkNote" ADD CONSTRAINT "SocialWorkNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkNote" ADD CONSTRAINT "SocialWorkNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkNote" ADD CONSTRAINT "SocialWorkNote_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkTask" ADD CONSTRAINT "SocialWorkTask_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkTask" ADD CONSTRAINT "SocialWorkTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkTask" ADD CONSTRAINT "SocialWorkTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkTask" ADD CONSTRAINT "SocialWorkTask_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkBenefit" ADD CONSTRAINT "SocialWorkBenefit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialWorkBenefit" ADD CONSTRAINT "SocialWorkBenefit_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistVisit" ADD CONSTRAINT "SpecialistVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistVisit" ADD CONSTRAINT "SpecialistVisit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistVisit" ADD CONSTRAINT "SpecialistVisit_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneInspection" ADD CONSTRAINT "ZoneInspection_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneInspection" ADD CONSTRAINT "ZoneInspection_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorBriefing" ADD CONSTRAINT "DirectorBriefing_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPatientOverride" ADD CONSTRAINT "ShiftPatientOverride_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPatientOverride" ADD CONSTRAINT "ShiftPatientOverride_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPatientOverride" ADD CONSTRAINT "ShiftPatientOverride_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAppointment" ADD CONSTRAINT "FamilyAppointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAppointment" ADD CONSTRAINT "FamilyAppointment_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAppointment" ADD CONSTRAINT "FamilyAppointment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAppointment" ADD CONSTRAINT "FamilyAppointment_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZendityMessage" ADD CONSTRAINT "ZendityMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZendityMessage" ADD CONSTRAINT "ZendityMessage_targetHqId_fkey" FOREIGN KEY ("targetHqId") REFERENCES "Headquarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

