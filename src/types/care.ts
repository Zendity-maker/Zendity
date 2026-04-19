export interface CaregiverSession {
    id: string;
    caregiverId: string;
    headquartersId: string;
    shiftType: string;
    startTime: string;
    endTime?: string | null;
    status: string;
    isZombie?: boolean;
    caregiver?: {
        id: string;
        name: string;
        role: string;
        pinCode?: string;
        complianceScore?: number | null;
    };
}

export interface TriageTicket {
    id: string;
    sourceId: string;
    sourceType: string;
    category: string;
    title: string;
    description: string;
    patientId?: string | null;
    patientName: string;
    urgency: string;
    createdAt: string;
    items?: TriageTicket[];
}

export interface FastActionAssignment {
    id: string;
    description: string;
    caregiverId: string;
    status: string;
    createdAt: string;
    expiresAt: string;
}

export interface MissingHandover {
    employeeId: string;
    employeeName: string;
    shiftType: string;
    endTime: string;
}

export interface LiveStats {
    activeCaregivers: number;
    baths: number;
    meals: Record<string, number>;
    incidents: number;
    triageInbox: number;
}

export interface FallIncidentLive {
    id: string;
    patientId: string;
    location: string;
    severity: 'NONE' | 'MILD' | 'SEVERE' | 'FATAL';
    interventions: string;
    notes: string | null;
    incidentDate: string;
    reportedAt: string;
    patient?: { id: string; name: string; colorGroup?: string | null } | null;
}

export interface VitalsFeedItem {
    id: string;
    patientId: string;
    patientName: string;
    colorGroup: string | null;
    caregiverId: string | null;
    caregiverName: string | null;
    status: 'PENDING' | 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' | 'EXPIRED';
    orderedAt: string;
    expiresAt: string;
    completedAt: string | null;
    penaltyApplied: boolean;
}

export interface VitalsByCaregiver {
    caregiverId: string | null;
    caregiverName: string;
    pending: number;
    completedOnTime: number;
    completedLate: number;
    expired: number;
}

export interface VitalsTotals {
    total: number;
    pending: number;
    completed: number;
    expired: number;
}

export interface MedsProgress {
    shift: 'MORNING' | 'EVENING' | 'NIGHT';
    completed: number;
    total: number;
    pct: number | null;
}

export interface TeamScore {
    caregiverId: string;
    name: string;
    role: string;
    complianceScore: number | null;
}

export interface HandoverFeedItem {
    id: string;
    shiftType: string;
    status: string;
    createdAt: string;
    signedOutAt: string | null;
    seniorConfirmedAt: string | null;
    supervisorSignedAt: string | null;
    handoverCompleted: boolean;
    outgoingName: string | null;
    incomingName: string | null;
    seniorName: string | null;
    supervisorName: string | null;
}

export interface ObservationFeedItem {
    id: string;
    createdAt: string;
    status: string;
    category: string;
    description: string;
    pointsDeducted: number | null;
    employeeId: string;
    employeeName: string;
    employeeRole: string;
    supervisorName: string;
    appealedAt: string | null;
    respondedAt: string | null;
}

export interface IncidentAppealItem {
    id: string;
    createdAt: string;
    status: string;
    severity: string;
    category: string;
    description: string;
    appealText: string | null;
    employeeName: string;
    appealedAt: string | null;
}

export interface RoundsSummary {
    inicio: number;
    medio: number;
    cierre: number;
    completedSlots: number;
    totalSlots: number;
}

export interface LiveDataPayload {
    hqId: string;
    timestamp: string;
    activeCaregivers: number;
    liveStats: LiveStats;
    activeSessions: CaregiverSession[];
    triageFeed: TriageTicket[];
    morningBriefing: string | null;
    lastBriefingAt: string | null;
    missingHandovers: MissingHandover[];
    activeFastActions: FastActionAssignment[];
    fallIncidents?: FallIncidentLive[];
    // Sprint K — Mission Control
    currentShift?: 'MORNING' | 'EVENING' | 'NIGHT';
    vitalsFeed?: VitalsFeedItem[];
    vitalsByCaregiver?: VitalsByCaregiver[];
    vitalsTotals?: VitalsTotals;
    medsProgress?: MedsProgress;
    teamScores?: TeamScore[];
    handoversFeed?: HandoverFeedItem[];
    observationsFeed?: ObservationFeedItem[];
    incidentAppeals?: IncidentAppealItem[];
    roundsSummary?: RoundsSummary;
}
