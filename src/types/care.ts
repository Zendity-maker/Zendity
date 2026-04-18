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
}
