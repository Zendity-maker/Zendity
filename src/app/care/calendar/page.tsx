"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import TransversalCalendar, { TransversalEvent } from "@/components/calendar/TransversalCalendar";

export default function CareCalendarPage() {
    const { user } = useAuth();
    const [events, setEvents] = useState<TransversalEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [currentDate] = useState(new Date());

    useEffect(() => { fetchEvents(); }, []);

    const fetchEvents = async () => {
        try {
            const res = await fetch("/api/corporate/calendar");
            const data = await res.json();
            if (data.success) {
                const mapped: TransversalEvent[] = (data.events || []).map((e: any) => ({
                    id: e.id,
                    type: e.type || "FACILITY_ROUTINE",
                    status: e.status || "PENDING",
                    title: e.title,
                    description: e.description || undefined,
                    startTime: new Date(e.startTime),
                    patientName: e.patient?.name || undefined,
                    isReprogrammed: false,
                }));
                setEvents(mapped);
            }
        } catch (err) {
            console.error("Calendar fetch error", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async (eventId: string, reason: string) => {
        try {
            await fetch(`/api/corporate/calendar?id=${eventId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "DISMISSED", dismissReason: reason }),
            });
            await fetchEvents();
        } catch (err) { console.error(err); }
    };

    const handleComplete = async (eventId: string) => {
        try {
            await fetch(`/api/corporate/calendar?id=${eventId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "COMPLETED" }),
            });
            await fetchEvents();
        } catch (err) { console.error(err); }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch("/api/corporate/calendar/sync", { method: "POST" });
            const data = await res.json();
            if (data.success) await fetchEvents();
        } catch (err) {
            console.error(err);
        } finally {
            setSyncing(false);
        }
    };

    const role = user?.role === "CAREGIVER" ? "CAREGIVER" : "CLINICAL_DIRECTOR";

    if (loading) return (
        <div className="flex items-center justify-center p-32">
            <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-8">
            <div className="w-full max-w-[1400px] mx-auto">
                <div className="flex justify-end mb-4">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-black px-6 py-3 rounded-[1.5rem] text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                    >
                        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {syncing ? "Sincronizando..." : "Sincronizar Eventos"}
                    </button>
                </div>
                <TransversalCalendar
                    role={role as "CAREGIVER" | "CLINICAL_DIRECTOR" | "SUPER_ADMIN"}
                    events={events}
                    currentDate={currentDate}
                    onDismiss={handleDismiss}
                    onComplete={handleComplete}
                />
            </div>
        </div>
    );
}
