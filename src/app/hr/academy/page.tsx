"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import PerformanceAcademyDashboard, { PerformanceUI, AcademyCapsuleUI } from "@/components/performance/PerformanceAcademyDashboard";

export default function AcademyPage() {
    const { user } = useAuth();
    const [performances, setPerformances] = useState<PerformanceUI[]>([]);
    const [capsules, setCapsules] = useState<AcademyCapsuleUI[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { if (user) fetchData(); }, [user]);

    const fetchData = async () => {
        try {
            const hqId = user?.hqId || user?.headquartersId || "";
            const [perfRes, capRes] = await Promise.all([
                fetch(`/api/hr/performance?hqId=${hqId}`),
                fetch(`/api/hr/academy?hqId=${hqId}`)
            ]);
            const perfData = perfRes.ok ? await perfRes.json() : {};
            const capData = capRes.ok ? await capRes.json() : {};
            setPerformances(perfData.performances || []);
            setCapsules(capData.capsules || []);
        } catch (err) {
            console.error("Academy fetch error", err);
        } finally {
            setLoading(false);
        }
    };

    const handleTakeModule = async (capsuleId: string) => {
        try {
            await fetch(`/api/hr/academy/${capsuleId}/start`, { method: "POST" });
            await fetchData();
        } catch (err) { console.error(err); }
    };

    const handleOverride = async (scoreId: string, newScore: number) => {
        try {
            await fetch(`/api/hr/performance/${scoreId}/override`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ humanScore: newScore }),
            });
            await fetchData();
        } catch (err) { console.error(err); }
    };

    const role = user?.role === "CAREGIVER"
        ? "CAREGIVER"
        : user?.role === "ADMIN" || user?.role === "DIRECTOR"
            ? "HQ_OWNER"
            : "SUPERVISOR";

    if (loading) return (
        <div className="flex items-center justify-center p-32">
            <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-8">
            <div className="w-full max-w-[1200px] mx-auto">
                <PerformanceAcademyDashboard
                    role={role as "CAREGIVER" | "SUPERVISOR" | "HQ_OWNER"}
                    performances={performances}
                    activeCapsules={capsules}
                    onTakeModule={handleTakeModule}
                    onApplyOverride={handleOverride}
                />
            </div>
        </div>
    );
}
