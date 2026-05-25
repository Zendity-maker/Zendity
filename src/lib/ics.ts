/**
 * Generador de archivos .ics (iCalendar / RFC 5545) para citas familiares.
 *
 * Por qué: el portal familiar de Zéndity sirve a la diáspora — familia fuera de PR.
 * Mostrar la hora anclada a AST con etiqueta es necesario pero no suficiente; lo
 * que de verdad protege a la familia es que la cita aterrice en SU calendario
 * nativo (Google/Apple/Outlook) con la conversión a su hora local automática.
 *
 * Estrategia: emitimos DTSTART/DTEND como instantes UTC absolutos. El calendario
 * nativo de cada familiar hace la conversión a su zona local. Cero ambigüedad.
 *
 * No usamos librería — el formato ICS es texto plano simple. Ojo con:
 *   - CRLF entre líneas (RFC requiere "\r\n").
 *   - Escape de caracteres especiales en TEXT: backslash, comma, semicolon, newline.
 *   - Line folding a 75 octets (lo omitimos — nuestros campos son cortos).
 */

export interface ICSAppointment {
    id: string;
    title: string;
    description?: string | null;
    startUtc: Date;
    endUtc: Date;
    location?: string | null;
    organizerName?: string;
    organizerEmail?: string;
}

/**
 * Formatea una Date a UTC ICS basic format: "20260527T170000Z".
 */
function fmtIcsUtc(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${h}${min}${s}Z`;
}

/**
 * Escapa caracteres especiales para campos TEXT del ICS.
 * RFC 5545 §3.3.11: backslash, comma, semicolon, newline.
 */
function escapeIcsText(s: string): string {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

/**
 * Genera el contenido de un archivo .ics para una cita familiar.
 * El DTSTART/DTEND son instantes UTC absolutos — el calendario del familiar
 * los convertirá a su zona local automáticamente.
 */
export function buildAppointmentICS(appt: ICSAppointment): string {
    const now = new Date();
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Zendity//Family Portal//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:appt-${appt.id}@zendity.com`,
        `DTSTAMP:${fmtIcsUtc(now)}`,
        `DTSTART:${fmtIcsUtc(appt.startUtc)}`,
        `DTEND:${fmtIcsUtc(appt.endUtc)}`,
        `SUMMARY:${escapeIcsText(appt.title)}`,
    ];
    if (appt.description) lines.push(`DESCRIPTION:${escapeIcsText(appt.description)}`);
    if (appt.location)    lines.push(`LOCATION:${escapeIcsText(appt.location)}`);
    if (appt.organizerName && appt.organizerEmail) {
        lines.push(`ORGANIZER;CN=${escapeIcsText(appt.organizerName)}:mailto:${appt.organizerEmail}`);
    }
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');
    // CRLF según RFC 5545.
    return lines.join('\r\n') + '\r\n';
}

/**
 * URL "Add to Google Calendar" — útil como atajo en el email para usuarios
 * que viven en GCal. Google Calendar acepta los timestamps en UTC con el
 * sufijo Z y hace la conversión a la TZ del usuario al abrir.
 *
 * Ej: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...
 *      &dates=20260527T170000Z/20260527T173000Z&details=...&location=...
 */
export function googleCalendarLink(appt: ICSAppointment): string {
    const base = 'https://calendar.google.com/calendar/render';
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: appt.title,
        dates: `${fmtIcsUtc(appt.startUtc)}/${fmtIcsUtc(appt.endUtc)}`,
    });
    if (appt.description) params.append('details', appt.description);
    if (appt.location)    params.append('location', appt.location);
    return `${base}?${params.toString()}`;
}
