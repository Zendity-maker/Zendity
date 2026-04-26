"use client";

import React, { forwardRef } from "react";

interface ShiftEntry {
    tempId: string;
    userId: string;
    userName: string;
    date: string;
    shiftType: string;
    colorGroup: string | null;
    notes?: string;
    isAbsent?: boolean;
    isManual?: boolean;
    customStartTime?: string | null;
    customEndTime?: string | null;
    customDescription?: string | null;
}

interface StaffMember {
    id: string;
    name: string;
    role: string;
}

interface Props {
    weekStart: Date;
    weekDays: Date[];
    shifts: ShiftEntry[];
    staff: StaffMember[];
    isPublished: boolean;
    hqName: string;
    hqLogoUrl: string | null;
    generatedByName: string;
}

const ROLE_ORDER = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CAREGIVER', 'CLEANING', 'KITCHEN', 'MAINTENANCE'];
const ROLE_LABELS: Record<string, string> = {
    DIRECTOR: 'Director',
    ADMIN: 'Admin',
    SUPERVISOR: 'Supervisor',
    NURSE: 'Enfermero/a',
    CAREGIVER: 'Cuidador/a',
    CLEANING: 'Limpieza',
    KITCHEN: 'Cocina',
    MAINTENANCE: 'Mantenimiento',
};

const SHIFT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    MORNING: { bg: '#DBEAFE', text: '#1E40AF', label: '6A-2P' },
    EVENING: { bg: '#FED7AA', text: '#9A3412', label: '2P-10P' },
    NIGHT: { bg: '#DDD6FE', text: '#5B21B6', label: '10P-6A' },
    SUPERVISOR_DAY: { bg: '#F3E8FF', text: '#7E22CE', label: '9A-6P' },
};

const formatTime = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        .toLowerCase().replace(/\s/g, '');
};

const formatDate = (d: Date): string =>
    d.toLocaleDateString('es-PR', { day: 'numeric', month: 'short' });

const formatDayShort = (d: Date): string =>
    d.toLocaleDateString('es-PR', { weekday: 'short' }).replace('.', '').toUpperCase();

const SchedulePrintView = forwardRef<HTMLDivElement, Props>(
    ({ weekStart, weekDays, shifts, staff, isPublished, hqName, hqLogoUrl, generatedByName }, ref) => {

        // Agrupar por rol (solo empleados con al menos un turno)
        const employeesWithShifts = staff.filter(s => shifts.some(sh => sh.userId === s.id));
        const grouped: Record<string, StaffMember[]> = {};
        for (const emp of employeesWithShifts) {
            const key = emp.role || 'OTHER';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(emp);
        }
        const sortedRoles = Object.keys(grouped).sort((a, b) => {
            const ai = ROLE_ORDER.indexOf(a);
            const bi = ROLE_ORDER.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });

        const weekEnd = weekDays[6];
        const weekRange = `${formatDate(weekStart)} — ${formatDate(weekEnd)} ${weekEnd.getFullYear()}`;
        const generatedAt = new Date().toLocaleString('es-PR', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const renderShiftCell = (shift: ShiftEntry | undefined) => {
            if (!shift) {
                return (
                    <div style={{ minHeight: '28px', backgroundColor: '#F8FAFC', borderRadius: '3px' }} />
                );
            }
            if (shift.isAbsent) {
                return (
                    <div style={{ padding: '3px 6px', borderRadius: '3px', backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: '9px', fontWeight: 800, textAlign: 'center' }}>
                        AUSENTE
                    </div>
                );
            }
            if (shift.isManual) {
                return (
                    <div style={{ padding: '3px 4px', borderRadius: '3px', backgroundColor: '#CCFBF1', color: '#0F6E56', fontSize: '9px', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                        {formatTime(shift.customStartTime)}–{formatTime(shift.customEndTime)}
                    </div>
                );
            }
            const cfg = SHIFT_COLORS[shift.shiftType];
            if (!cfg) return <div style={{ fontSize: '9px', color: '#94A3B8' }}>{shift.shiftType}</div>;
            return (
                <div style={{ padding: '3px 4px', borderRadius: '3px', backgroundColor: cfg.bg, color: cfg.text, fontSize: '9px', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                    {cfg.label}
                    {shift.colorGroup && shift.colorGroup !== 'NONE' && (
                        <div style={{ fontSize: '7px', marginTop: '1px', opacity: 0.8 }}>
                            {shift.colorGroup}
                        </div>
                    )}
                    {shift.notes && (
                        <div style={{ fontSize: '7px', color: '#555555', fontStyle: 'italic', fontWeight: 400, marginTop: '4px', borderTop: '1px solid #DDDDDD', paddingTop: '3px', textAlign: 'left', lineHeight: 1.3 }}>
                            📝 {shift.notes}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div
                ref={ref}
                style={{
                    position: 'absolute',
                    top: '-10000px',
                    left: '-10000px',
                    width: '1200px',
                    backgroundColor: '#FFFFFF',
                    padding: '30px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    color: '#1E293B',
                    boxSizing: 'border-box',
                }}
            >
                {/* HEADER — banda negra con logo + título */}
                <div style={{
                    backgroundColor: '#0F172A',
                    padding: '18px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {hqLogoUrl ? (
                            <img src={hqLogoUrl} alt={hqName} crossOrigin="anonymous"
                                style={{ height: '44px', width: 'auto', objectFit: 'contain', backgroundColor: '#FFFFFF', padding: '3px 6px', borderRadius: '6px' }} />
                        ) : (
                            <div style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 300, letterSpacing: '1px' }}>vivid senior living</div>
                        )}
                        <div>
                            <div style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 700 }}>{hqName}</div>
                            <div style={{ color: '#5EEAD4', fontSize: '10px', fontWeight: 500 }}>Cupey, Puerto Rico</div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' }}>Horario Semanal</div>
                        <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '2px' }}>{weekRange}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{
                            display: 'inline-block',
                            padding: '5px 12px',
                            borderRadius: '999px',
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '1.5px',
                            backgroundColor: isPublished ? '#10B981' : '#F59E0B',
                            color: '#FFFFFF',
                        }}>
                            {isPublished ? 'PUBLICADO' : 'BORRADOR'}
                        </span>
                        <div style={{ color: '#5EEAD4', fontSize: '9px', fontWeight: 500, marginTop: '4px' }}>Powered by Zéndity</div>
                    </div>
                </div>

                {/* TABLA */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#F1F5F9' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid #E2E8F0', width: '22%' }}>Empleado</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid #E2E8F0', width: '11%' }}>Rol</th>
                            {weekDays.map((d, i) => (
                                <th key={i} style={{ padding: '8px 4px', textAlign: 'center', fontSize: '10px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid #E2E8F0', width: '9.5%' }}>
                                    <div>{formatDayShort(d)}</div>
                                    <div style={{ fontSize: '9px', fontWeight: 600, color: '#64748B', marginTop: '1px' }}>{d.getDate()}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRoles.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ padding: '30px', textAlign: 'center', fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', border: '1px solid #E2E8F0' }}>
                                    Sin turnos asignados esta semana
                                </td>
                            </tr>
                        ) : sortedRoles.map(role => (
                            <React.Fragment key={`role-${role}`}>
                                {/* Row header por rol */}
                                <tr>
                                    <td colSpan={9} style={{
                                        padding: '5px 12px',
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        color: '#0F6E56',
                                        textTransform: 'uppercase',
                                        letterSpacing: '2px',
                                        backgroundColor: '#E1F5EE',
                                        border: '1px solid #E2E8F0',
                                    }}>
                                        {ROLE_LABELS[role] || role} ({grouped[role].length})
                                    </td>
                                </tr>
                                {grouped[role].map(emp => (
                                    <tr key={emp.id}>
                                        <td style={{ padding: '6px 10px', border: '1px solid #E2E8F0', fontSize: '10px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</td>
                                        <td style={{ padding: '6px 10px', border: '1px solid #E2E8F0', fontSize: '9px', color: '#64748B', fontWeight: 500 }}>{ROLE_LABELS[emp.role] || emp.role}</td>
                                        {weekDays.map((day, di) => {
                                            const dateStr = day.toISOString().split('T')[0];
                                            const shift = shifts.find(s => s.userId === emp.id && s.date === dateStr);
                                            return (
                                                <td key={di} style={{ padding: '4px 3px', border: '1px solid #E2E8F0', verticalAlign: 'middle' }}>
                                                    {renderShiftCell(shift)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>

                {/* Leyenda */}
                <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '9px', color: '#64748B', fontWeight: 600, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '14px', height: '10px', backgroundColor: '#DBEAFE', display: 'inline-block', borderRadius: '2px' }}></span>
                        Diurno 6A-2P
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '14px', height: '10px', backgroundColor: '#FED7AA', display: 'inline-block', borderRadius: '2px' }}></span>
                        Vespertino 2P-10P
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '14px', height: '10px', backgroundColor: '#DDD6FE', display: 'inline-block', borderRadius: '2px' }}></span>
                        Nocturno 10P-6A
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '14px', height: '10px', backgroundColor: '#F3E8FF', display: 'inline-block', borderRadius: '2px' }}></span>
                        Supervisor 9A-6P
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '14px', height: '10px', backgroundColor: '#CCFBF1', display: 'inline-block', borderRadius: '2px' }}></span>
                        Manual
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '14px', height: '10px', backgroundColor: '#FEE2E2', display: 'inline-block', borderRadius: '2px' }}></span>
                        Ausente
                    </div>
                </div>

                {/* FOOTER */}
                <div style={{
                    borderTop: '2px solid #14B8A6',
                    marginTop: '20px',
                    paddingTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    color: '#64748B',
                    fontWeight: 600,
                }}>
                    <span>Generado por {generatedByName} · {generatedAt}</span>
                    <span>Zéndity Healthcare Platform</span>
                </div>
            </div>
        );
    }
);

SchedulePrintView.displayName = "SchedulePrintView";

export default SchedulePrintView;
