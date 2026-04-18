"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    CheckCircle2, Camera, X, ChevronDown, ChevronUp,
    Loader2, Clock, SprayCan, ImageIcon, Bell, Play, AlertTriangle
} from "lucide-react";

const CATEGORY_STYLES: Record<string, string> = {
    BATHROOM: "bg-blue-100 text-blue-700 border-blue-200",
    ROOM: "bg-teal-100 text-teal-700 border-teal-200",
    COMMON: "bg-slate-100 text-slate-600 border-slate-200",
    TRASH: "bg-amber-100 text-amber-700 border-amber-200",
};

const CATEGORY_LABELS: Record<string, string> = {
    BATHROOM: "Bano",
    ROOM: "Habitacion",
    COMMON: "Area Comun",
    TRASH: "Zafacones",
};

type CleaningArea = {
    id: string;
    name: string;
    floor: string;
    category: string;
    roomNumber: string | null;
    requiresPhoto: boolean;
    order: number;
};

type CleaningLog = {
    id: string;
    areaId: string;
    cleanedById: string;
    status: string;
    photoUrl: string | null;
    photoRequested: boolean;
    notes: string | null;
    cleanedAt: string;
    area: { id: string; name: string };
    cleanedBy: { id: string; name: string };
};

export default function CleaningDashboardPage() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<"shift" | "requests" | "history">("shift");

    // Shift tab state
    const [firstFloor, setFirstFloor] = useState<CleaningArea[]>([]);
    const [secondFloor, setSecondFloor] = useState<CleaningArea[]>([]);
    const [todayLogs, setTodayLogs] = useState<CleaningLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [firstFloorOpen, setFirstFloorOpen] = useState(true);
    const [secondFloorOpen, setSecondFloorOpen] = useState(true);

    // Modal state
    const [confirmArea, setConfirmArea] = useState<CleaningArea | null>(null);
    const [photoRequired, setPhotoRequired] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmNotes, setConfirmNotes] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // History tab state
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split("T")[0]);
    const [historyLogs, setHistoryLogs] = useState<CleaningLog[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Requests tab state
    type CleaningRequestItem = {
        id: string; areaName: string; description: string; photoUrl: string | null;
        status: string; priority: string; expiresAt: string; createdAt: string;
        requestedBy: { id: string; name: string; role: string };
        assignedTo: { id: string; name: string } | null;
        area: { id: string; name: string; category: string } | null;
    };
    const [requests, setRequests] = useState<CleaningRequestItem[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

    const hqId = user?.hqId || user?.headquartersId || "";

    // Fetch areas + today's logs
    useEffect(() => {
        if (!hqId) return;
        fetchShiftData();
    }, [hqId]);

    const fetchShiftData = async () => {
        setLoading(true);
        try {
            const [areasRes, logsRes] = await Promise.all([
                fetch(`/api/cleaning/areas?hqId=${hqId}`),
                fetch(`/api/cleaning/log?hqId=${hqId}`),
            ]);
            const areasData = await areasRes.json();
            const logsData = await logsRes.json();

            if (areasData.success) {
                setFirstFloor(areasData.firstFloor);
                setSecondFloor(areasData.secondFloor);
            }
            if (logsData.success) {
                setTodayLogs(logsData.logs);
            }
        } catch (e) {
            console.error("Error loading cleaning data:", e);
        } finally {
            setLoading(false);
        }
    };

    // Requests fetch + polling
    useEffect(() => {
        if (!hqId) return;
        fetchRequests();
        const interval = setInterval(fetchRequests, 60000);
        return () => clearInterval(interval);
    }, [hqId]);

    const fetchRequests = async () => {
        try {
            const res = await fetch(`/api/cleaning/requests?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) setRequests(data.requests);
        } catch (e) { console.error(e); }
    };

    const updateRequest = async (requestId: string, status: string) => {
        setUpdatingRequestId(requestId);
        try {
            const res = await fetch("/api/cleaning/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, status }),
            });
            const data = await res.json();
            if (data.success) fetchRequests();
        } catch (e) { console.error(e); }
        finally { setUpdatingRequestId(null); }
    };

    const getTimeRemaining = (expiresAt: string) => {
        const diff = new Date(expiresAt).getTime() - Date.now();
        if (diff <= 0) return { text: "Expirada", color: "text-slate-500" };
        const mins = Math.ceil(diff / 60000);
        if (mins > 30) return { text: `${mins} min`, color: "text-emerald-600" };
        if (mins > 15) return { text: `${mins} min`, color: "text-amber-600" };
        return { text: `${mins} min`, color: "text-rose-600" };
    };

    const pendingRequestCount = requests.filter(r => r.status === "PENDING").length;

    // History fetch
    useEffect(() => {
        if (activeTab === "history" && hqId) fetchHistory();
    }, [activeTab, historyDate, hqId]);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/cleaning/log?hqId=${hqId}&date=${historyDate}`);
            const data = await res.json();
            if (data.success) setHistoryLogs(data.logs);
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Check if area was completed today
    const getLogForArea = (areaId: string) =>
        todayLogs.find((l) => l.areaId === areaId);

    // Progress
    const allAreas = [...firstFloor, ...secondFloor];
    const completedCount = allAreas.filter((a) => getLogForArea(a.id)).length;
    const totalCount = allAreas.length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Open confirm modal
    const openConfirm = (area: CleaningArea) => {
        const needsPhoto = area.requiresPhoto;
        setConfirmArea(area);
        setPhotoRequired(needsPhoto);
        setCapturedPhoto(null);
        setConfirmNotes("");
    };

    // Handle file capture
    const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const MAX = 500;
            let w = img.width;
            let h = img.height;
            if (w > h) { h = (h / w) * MAX; w = MAX; }
            else { w = (w / h) * MAX; h = MAX; }
            canvas.width = w;
            canvas.height = h;
            ctx?.drawImage(img, 0, 0, w, h);
            const base64 = canvas.toDataURL("image/jpeg", 0.8);
            setCapturedPhoto(base64);
            URL.revokeObjectURL(img.src);
        };
    };

    // Submit cleaning log
    const submitLog = async () => {
        if (!confirmArea || !user) return;
        if (photoRequired && !capturedPhoto) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/cleaning/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    areaId: confirmArea.id,
                    status: "COMPLETED",
                    photoUrl: capturedPhoto || null,
                    photoRequested: photoRequired,
                    notes: confirmNotes || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setTodayLogs((prev) => [data.log, ...prev]);
                setConfirmArea(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    // Area card
    const AreaCard = ({ area }: { area: CleaningArea }) => {
        const log = getLogForArea(area.id);
        const isDone = !!log;
        return (
            <div className={`rounded-2xl p-5 border-2 transition-all ${isDone ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200 hover:border-teal-300"}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${CATEGORY_STYLES[area.category] || CATEGORY_STYLES.COMMON}`}>
                                {CATEGORY_LABELS[area.category] || area.category}
                            </span>
                            {area.requiresPhoto && (
                                <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                    <Camera className="w-3 h-3" /> Foto requerida
                                </span>
                            )}
                        </div>
                        <p className="font-bold text-slate-800 text-base leading-tight">{area.name}</p>
                        {area.category === "ROOM" && area.roomNumber && (
                            <p className="text-xs text-slate-500 mt-0.5">Hab. {area.roomNumber}</p>
                        )}
                    </div>
                    {isDone ? (
                        <div className="flex flex-col items-end shrink-0">
                            <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                                <CheckCircle2 className="w-5 h-5" /> Completada
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                {new Date(log!.cleanedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                    ) : (
                        <button
                            onClick={() => openConfirm(area)}
                            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition-all active:scale-95 shrink-0 shadow-sm"
                        >
                            Registrar
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900">
                <Loader2 className="w-12 h-12 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full min-h-screen bg-slate-900 font-sans">
            {/* Hidden file input for camera */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileCapture}
            />

            {/* Header */}
            <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md">
                        <SprayCan className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Limpieza & Sanitizacion</h1>
                        <span className="text-[10px] uppercase font-black tracking-widest text-teal-400">Zendity Cleaning</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-bold text-white">{user?.name}</p>
                        <p className="text-[10px] uppercase font-black text-slate-500 tracking-wider">{user?.role}</p>
                    </div>
                    {user?.photoUrl ? (
                        <img src={user.photoUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-teal-500" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-teal-700 border-2 border-teal-500 flex items-center justify-center text-white font-black text-sm">
                            {user?.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"}
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className="px-4 py-2 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 font-bold text-sm rounded-xl transition-colors border border-slate-700"
                    >
                        Salir
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-2">
                <button
                    onClick={() => setActiveTab("shift")}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === "shift" ? "bg-teal-600 text-white shadow-lg shadow-teal-600/30" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}
                >
                    Mi Turno
                </button>
                <button
                    onClick={() => setActiveTab("requests")}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all relative ${activeTab === "requests" ? "bg-teal-600 text-white shadow-lg shadow-teal-600/30" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}
                >
                    Solicitudes
                    {pendingRequestCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                            {pendingRequestCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === "history" ? "bg-teal-600 text-white shadow-lg shadow-teal-600/30" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}
                >
                    Historial
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                {activeTab === "shift" && (
                    <div className="space-y-6">
                        {/* Progress bar */}
                        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-white font-bold text-sm">
                                    {completedCount} de {totalCount} areas completadas hoy
                                </p>
                                <span className="text-teal-400 font-black text-lg">{progressPct}%</span>
                            </div>
                            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>

                        {/* First Floor */}
                        <div>
                            <button
                                onClick={() => setFirstFloorOpen(!firstFloorOpen)}
                                className="w-full flex items-center justify-between bg-slate-800 rounded-xl px-5 py-3.5 border border-slate-700 hover:border-slate-600 transition-colors"
                            >
                                <span className="text-white font-black text-base tracking-tight">Primer Piso</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-500 text-xs font-bold">
                                        {firstFloor.filter((a) => getLogForArea(a.id)).length}/{firstFloor.length}
                                    </span>
                                    {firstFloorOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                </div>
                            </button>
                            {firstFloorOpen && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                                    {firstFloor.map((area) => (
                                        <AreaCard key={area.id} area={area} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Second Floor */}
                        <div>
                            <button
                                onClick={() => setSecondFloorOpen(!secondFloorOpen)}
                                className="w-full flex items-center justify-between bg-slate-800 rounded-xl px-5 py-3.5 border border-slate-700 hover:border-slate-600 transition-colors"
                            >
                                <span className="text-white font-black text-base tracking-tight">Segundo Piso</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-500 text-xs font-bold">
                                        {secondFloor.filter((a) => getLogForArea(a.id)).length}/{secondFloor.length}
                                    </span>
                                    {secondFloorOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                </div>
                            </button>
                            {secondFloorOpen && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                                    {secondFloor.map((area) => (
                                        <AreaCard key={area.id} area={area} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "requests" && (
                    <div className="space-y-3">
                        {requestsLoading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="bg-slate-800 rounded-2xl p-12 text-center border border-slate-700">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                                <p className="text-white font-bold">Sin solicitudes activas</p>
                                <p className="text-slate-500 text-sm mt-1">Todas las solicitudes han sido atendidas</p>
                            </div>
                        ) : (
                            requests.map((req) => {
                                const sla = getTimeRemaining(req.expiresAt);
                                const isPending = req.status === "PENDING";
                                const isInProgress = req.status === "IN_PROGRESS";
                                return (
                                    <div key={req.id} className={`rounded-2xl p-5 border-2 transition-all ${req.priority === "URGENT" ? "bg-rose-950/30 border-rose-700" : "bg-slate-800 border-slate-700"}`}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                    {req.priority === "URGENT" && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" /> URGENTE
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isPending ? "bg-amber-900/50 text-amber-400 border border-amber-800" : "bg-blue-900/50 text-blue-400 border border-blue-800"}`}>
                                                        {isPending ? "Pendiente" : "En Progreso"}
                                                    </span>
                                                    <span className={`text-[10px] font-black ${sla.color}`}>
                                                        <Clock className="w-3 h-3 inline mr-1" />{sla.text}
                                                    </span>
                                                </div>
                                                <p className="font-bold text-white text-base">{req.areaName}</p>
                                                <p className="text-slate-400 text-sm mt-1">{req.description}</p>
                                                <p className="text-slate-500 text-xs mt-2">
                                                    Solicitado por {req.requestedBy.name} — {new Date(req.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                                {isInProgress && req.assignedTo && (
                                                    <p className="text-blue-400 text-xs mt-1 font-bold">Tomado por: {req.assignedTo.name}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2 shrink-0">
                                                {req.photoUrl && (
                                                    <img src={req.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-600" />
                                                )}
                                                {isPending && (
                                                    <button
                                                        onClick={() => updateRequest(req.id, "IN_PROGRESS")}
                                                        disabled={updatingRequestId === req.id}
                                                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                                    >
                                                        <Play className="w-3.5 h-3.5" /> Tomar
                                                    </button>
                                                )}
                                                {isInProgress && (
                                                    <button
                                                        onClick={() => updateRequest(req.id, "COMPLETED")}
                                                        disabled={updatingRequestId === req.id}
                                                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Completar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <input
                                type="date"
                                value={historyDate}
                                onChange={(e) => setHistoryDate(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white font-bold px-4 py-2.5 rounded-xl focus:outline-none focus:border-teal-500"
                            />
                            <span className="text-slate-500 text-sm font-medium">
                                {historyLogs.length} registros
                            </span>
                        </div>

                        {historyLoading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                            </div>
                        ) : historyLogs.length === 0 ? (
                            <div className="bg-slate-800 rounded-2xl p-12 text-center border border-slate-700">
                                <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 font-bold">Sin registros para esta fecha</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {historyLogs.map((log) => (
                                    <div key={log.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-4">
                                        {log.photoUrl ? (
                                            <img src={log.photoUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-600 shrink-0" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0">
                                                <ImageIcon className="w-5 h-5 text-slate-500" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-sm truncate">{log.area.name}</p>
                                            <p className="text-slate-500 text-xs font-medium">
                                                {log.cleanedBy.name} — {new Date(log.cleanedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                            {log.notes && <p className="text-slate-400 text-xs mt-1 truncate">{log.notes}</p>}
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${log.status === "COMPLETED" ? "bg-emerald-900/30 text-emerald-400 border-emerald-800" : "bg-amber-900/30 text-amber-400 border-amber-800"}`}>
                                            {log.status === "COMPLETED" ? "Completado" : "Omitido"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Confirm / Photo Modal */}
            {confirmArea && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        {/* Modal header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-slate-800 text-lg">Registrar Limpieza</h3>
                                <p className="text-sm text-slate-500 font-medium">{confirmArea.name}</p>
                            </div>
                            <button onClick={() => setConfirmArea(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {photoRequired ? (
                                <>
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                        <Camera className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold text-amber-800 text-sm">Zendi necesita evidencia fotografica de esta area</p>
                                            <p className="text-amber-600 text-xs mt-1">Toma una foto del area limpia para completar el registro.</p>
                                        </div>
                                    </div>

                                    {capturedPhoto ? (
                                        <div className="relative">
                                            <img src={capturedPhoto} alt="Preview" className="w-full h-48 object-cover rounded-xl border-2 border-teal-200" />
                                            <button
                                                onClick={() => { setCapturedPhoto(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                                className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full shadow-md hover:bg-white"
                                            >
                                                <X className="w-4 h-4 text-slate-600" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full py-8 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center gap-3 hover:border-teal-400 hover:bg-teal-50/50 transition-colors"
                                        >
                                            <Camera className="w-8 h-8 text-slate-400" />
                                            <span className="font-bold text-slate-500 text-sm">Tomar Foto</span>
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                                    <p className="font-bold text-teal-800">Confirmas que limpiaste esta area?</p>
                                </div>
                            )}

                            {/* Notes */}
                            <input
                                type="text"
                                value={confirmNotes}
                                onChange={(e) => setConfirmNotes(e.target.value)}
                                placeholder="Notas (opcional)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
                            />
                        </div>

                        {/* Modal footer */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setConfirmArea(null)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitLog}
                                disabled={submitting || (photoRequired && !capturedPhoto)}
                                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-600/30 flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                {submitting ? "Registrando..." : "Confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
