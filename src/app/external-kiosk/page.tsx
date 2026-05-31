"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Users, Building2, X, MessageSquare } from "lucide-react";

const TOKEN_KEY = "zendity_kiosk_token";
const PING_INTERVAL_MS = 5 * 60 * 1000;     // 5 min heartbeat
const IDLE_RESET_MS    = 90 * 1000;          // 90s sin actividad → reset al inicio

type Step = "welcome" | "category" | "provider" | "scope" | "patients" | "details" | "confirm" | "done";

interface ProviderLite { id: string; name: string; }
interface CategoryLite { id: string; name: string; icon: string | null; providers: ProviderLite[]; }
interface PatientLite { id: string; name: string; roomNumber: string | null; photoUrl: string | null; colorGroup: string; }
interface BootstrapPayload {
    success: boolean;
    device: { headquartersId: string; floor: number; label: string };
    categories: CategoryLite[];
    patients: PatientLite[];
}

export default function ExternalKioskPage() {
    const router = useRouter();

    // ── Estado de bootstrap ────────────────────────────────────────────
    const [token, setToken] = useState<string | null>(null);
    const [boot, setBoot] = useState<BootstrapPayload | null>(null);
    const [bootError, setBootError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // ── Estado del flujo ───────────────────────────────────────────────
    const [step, setStep] = useState<Step>("welcome");
    const [category, setCategory] = useState<CategoryLite | null>(null);
    const [provider, setProvider] = useState<ProviderLite | null>(null);
    const [scope, setScope] = useState<"facility" | "specific" | null>(null);
    const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
    const [serviceType, setServiceType] = useState("");
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // ── Bootstrap inicial ──────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;
        const t = localStorage.getItem(TOKEN_KEY);
        if (!t) {
            setBootError("Esta tablet no está configurada. Pide al administrador la URL de setup.");
            setLoading(false);
            return;
        }
        setToken(t);
    }, []);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/external-kiosk/bootstrap", {
                    headers: { "x-device-token": token },
                    cache: "no-store",
                });
                const data = await res.json();
                if (cancelled) return;
                if (!data.success) {
                    setBootError(data.error || "Error cargando kiosko");
                } else {
                    setBoot(data);
                }
            } catch (e) {
                if (!cancelled) setBootError("Sin conexión. Verifica el WiFi de la tablet.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [token]);

    // ── Heartbeat ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!token) return;
        const tick = () => {
            fetch("/api/external-kiosk/ping", { headers: { "x-device-token": token }, cache: "no-store" })
                .catch(() => {});
        };
        const id = setInterval(tick, PING_INTERVAL_MS);
        return () => clearInterval(id);
    }, [token]);

    // ── Reset por inactividad ─────────────────────────────────────────
    useEffect(() => {
        if (step === "welcome") return;
        let timer: NodeJS.Timeout;
        const reset = () => {
            timer = setTimeout(() => goWelcome(), IDLE_RESET_MS);
        };
        const cancel = () => clearTimeout(timer);
        reset();
        const events: (keyof DocumentEventMap)[] = ["touchstart", "click", "keydown"];
        const onActivity = () => { cancel(); reset(); };
        events.forEach(ev => document.addEventListener(ev, onActivity));
        return () => {
            cancel();
            events.forEach(ev => document.removeEventListener(ev, onActivity));
        };
    }, [step]);

    const goWelcome = useCallback(() => {
        setStep("welcome");
        setCategory(null);
        setProvider(null);
        setScope(null);
        setSelectedPatientIds([]);
        setServiceType("");
        setComment("");
    }, []);

    const togglePatient = (id: string) => {
        setSelectedPatientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const submit = async () => {
        if (!token || !provider) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/external-kiosk/visit", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-device-token": token },
                body: JSON.stringify({
                    providerId: provider.id,
                    serviceType: serviceType.trim() || null,
                    comment: comment.trim() || null,
                    isFacilityWide: scope === "facility",
                    patientIds: scope === "specific" ? selectedPatientIds : [],
                    notifyFamilies: true,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setStep("done");
                setTimeout(() => goWelcome(), 6000);
            } else {
                alert(data.error || "No se pudo registrar la visita");
            }
        } catch (e) {
            alert("Error de conexión. Intenta de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    const summaryResidents = useMemo(() => {
        if (scope === "facility") return "Toda la sede";
        if (!boot) return "";
        const names = boot.patients.filter(p => selectedPatientIds.includes(p.id)).map(p => p.name);
        if (names.length === 0) return "(ninguno)";
        if (names.length <= 3) return names.join(", ");
        return `${names.slice(0, 3).join(", ")} y ${names.length - 3} más`;
    }, [scope, selectedPatientIds, boot]);

    // ── Pantallas de error ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <Loader2 className="w-12 h-12 animate-spin" />
            </div>
        );
    }
    if (bootError) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
                <div className="bg-white rounded-3xl p-10 max-w-lg text-center shadow-2xl">
                    <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 flex items-center justify-center mb-4">
                        <X className="w-8 h-8 text-rose-600" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-2">Tablet no configurada</h1>
                    <p className="text-slate-600">{bootError}</p>
                </div>
            </div>
        );
    }
    if (!boot) return null;

    // ── Header del kiosko (siempre visible excepto welcome) ─────────────
    const Header = ({ back, title }: { back?: () => void; title: string }) => (
        <div className="flex items-center gap-4 px-8 pt-8 pb-4">
            {back && (
                <button
                    onClick={back}
                    className="w-14 h-14 rounded-2xl bg-white shadow flex items-center justify-center active:scale-95 transition"
                >
                    <ChevronLeft className="w-7 h-7 text-slate-700" />
                </button>
            )}
            <h1 className="text-3xl font-black text-slate-900">{title}</h1>
            <div className="ml-auto text-right">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{boot.device.label}</p>
                <p className="text-xs text-slate-400">Piso {boot.device.floor}</p>
            </div>
        </div>
    );

    // ── Render por step ─────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50">

            {/* WELCOME */}
            {step === "welcome" && (
                <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-teal-600 shadow-xl mb-6">
                            <Building2 className="w-14 h-14 text-white" />
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 mb-3">Bienvenido</h1>
                        <p className="text-2xl text-slate-600">Registro de Visita Externa</p>
                        <p className="text-base text-slate-400 mt-2">Vivid Senior Living Cupey · {boot.device.label}</p>
                    </div>
                    <button
                        onClick={() => setStep("category")}
                        className="bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-2xl font-black px-14 py-6 rounded-3xl shadow-xl transition"
                    >
                        Comenzar registro
                    </button>
                    <p className="text-sm text-slate-400 mt-8 max-w-md">
                        Toca para registrar tu visita. La familia del residente recibirá una actualización después de la revisión del director.
                    </p>
                </div>
            )}

            {/* CATEGORÍA */}
            {step === "category" && (
                <div>
                    <Header back={() => goWelcome()} title="¿Qué tipo de servicio brindas?" />
                    <div className="px-8 pb-8 grid grid-cols-2 md:grid-cols-3 gap-4">
                        {boot.categories.map(c => (
                            <button
                                key={c.id}
                                onClick={() => { setCategory(c); setStep("provider"); }}
                                className="bg-white rounded-3xl p-8 shadow hover:shadow-lg active:scale-95 transition text-center"
                            >
                                <div className="text-6xl mb-3">{c.icon || "🏷️"}</div>
                                <h3 className="text-xl font-black text-slate-800">{c.name}</h3>
                                <p className="text-sm text-slate-500 mt-1">{c.providers.length} {c.providers.length === 1 ? "opción" : "opciones"}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* PROVEEDOR */}
            {step === "provider" && category && (
                <div>
                    <Header back={() => setStep("category")} title={`${category.icon || ""} ${category.name}`} />
                    <div className="px-8 pb-8">
                        <p className="text-lg text-slate-600 mb-4">Selecciona tu entidad:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {category.providers.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { setProvider(p); setStep("scope"); }}
                                    className="bg-white rounded-2xl px-6 py-5 shadow hover:shadow-lg active:scale-98 transition text-left"
                                >
                                    <h3 className="text-xl font-bold text-slate-800">{p.name}</h3>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* SCOPE */}
            {step === "scope" && provider && (
                <div>
                    <Header back={() => setStep("provider")} title="¿A quién visitas?" />
                    <div className="px-8 pb-8 max-w-3xl mx-auto space-y-4">
                        <p className="text-lg text-slate-600">Visita registrada por: <strong>{provider.name}</strong></p>
                        <button
                            onClick={() => { setScope("specific"); setStep("patients"); }}
                            className="w-full bg-white rounded-3xl p-8 shadow hover:shadow-lg active:scale-98 transition flex items-center gap-6 text-left"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center">
                                <Users className="w-8 h-8 text-teal-700" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">Residentes específicos</h3>
                                <p className="text-slate-500">Elige uno o varios de la lista</p>
                            </div>
                        </button>
                        <button
                            onClick={() => { setScope("facility"); setStep("details"); }}
                            className="w-full bg-white rounded-3xl p-8 shadow hover:shadow-lg active:scale-98 transition flex items-center gap-6 text-left"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
                                <Building2 className="w-8 h-8 text-indigo-700" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">Toda la sede</h3>
                                <p className="text-slate-500">La visita aplica a todos los residentes activos (ej. optómetra, podiatra)</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* PATIENTS */}
            {step === "patients" && (
                <div>
                    <Header back={() => setStep("scope")} title="Selecciona residentes" />
                    <div className="px-8 pb-32">
                        <p className="text-base text-slate-600 mb-3">
                            Toca cada residente que visitarás. Seleccionados: <strong className="text-teal-700">{selectedPatientIds.length}</strong>
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {boot.patients.map(p => {
                                const selected = selectedPatientIds.includes(p.id);
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => togglePatient(p.id)}
                                        className={`relative bg-white rounded-2xl p-4 shadow active:scale-95 transition text-left border-4 ${selected ? "border-teal-500" : "border-transparent"}`}
                                    >
                                        {selected && (
                                            <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center">
                                                <Check className="w-5 h-5 text-white" />
                                            </div>
                                        )}
                                        <div className="w-14 h-14 rounded-full bg-slate-200 mb-3 flex items-center justify-center text-lg font-black text-slate-600 overflow-hidden">
                                            {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" /> : p.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-base leading-tight">{p.name}</h3>
                                        {p.roomNumber && <p className="text-xs text-slate-500 mt-1">Cuarto {p.roomNumber}</p>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="fixed bottom-0 inset-x-0 bg-white border-t-2 border-slate-200 px-8 py-4 flex justify-between items-center shadow-2xl">
                        <span className="text-lg font-bold text-slate-700">{selectedPatientIds.length} seleccionado{selectedPatientIds.length === 1 ? "" : "s"}</span>
                        <button
                            onClick={() => setStep("details")}
                            disabled={selectedPatientIds.length === 0}
                            className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xl font-black px-10 py-4 rounded-2xl active:scale-95 transition"
                        >
                            Continuar →
                        </button>
                    </div>
                </div>
            )}

            {/* DETAILS — serviceType + comentario */}
            {step === "details" && provider && (
                <div>
                    <Header back={() => setStep(scope === "facility" ? "scope" : "patients")} title="Detalles de la visita" />
                    <div className="px-8 pb-8 max-w-2xl mx-auto space-y-5">
                        <div className="bg-white rounded-2xl p-6 shadow">
                            <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-2">Tipo de servicio (opcional)</label>
                            <input
                                type="text"
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value)}
                                placeholder="Ej: Sesión de terapia, Corte de pelo, Evaluación inicial…"
                                maxLength={120}
                                className="w-full text-lg border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-teal-500 outline-none"
                            />
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow">
                            <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Comentario (opcional)
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="¿Cómo estuvo la visita? Algo que la familia deba saber."
                                maxLength={2000}
                                rows={5}
                                className="w-full text-base border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-teal-500 outline-none resize-none"
                            />
                            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <div className="text-amber-600 text-lg leading-none">⚠</div>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    <strong>Tu nota será visible para la familia</strong> después de la revisión del director. No incluyas diagnósticos detallados ni medicamentos específicos.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setStep("confirm")}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white text-2xl font-black py-5 rounded-2xl shadow-xl active:scale-95 transition"
                        >
                            Revisar y enviar →
                        </button>
                    </div>
                </div>
            )}

            {/* CONFIRM */}
            {step === "confirm" && provider && (
                <div>
                    <Header back={() => setStep("details")} title="Confirma tu registro" />
                    <div className="px-8 pb-8 max-w-2xl mx-auto">
                        <div className="bg-white rounded-3xl p-8 shadow-xl space-y-4">
                            <Row label="Entidad" value={`${category?.icon || ""} ${provider.name}`} />
                            <Row label="Categoría" value={category?.name || ""} />
                            <Row label="Residentes" value={summaryResidents} />
                            {serviceType && <Row label="Servicio" value={serviceType} />}
                            {comment && (
                                <div>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Comentario</p>
                                    <p className="text-base text-slate-700 bg-slate-50 rounded-xl p-4">{comment}</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={submit}
                            disabled={submitting}
                            className="w-full mt-6 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white text-2xl font-black py-5 rounded-2xl shadow-xl active:scale-95 transition flex items-center justify-center gap-3"
                        >
                            {submitting ? <><Loader2 className="w-6 h-6 animate-spin" /> Enviando…</> : "Confirmar registro"}
                        </button>
                    </div>
                </div>
            )}

            {/* DONE */}
            {step === "done" && (
                <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
                    <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-emerald-500 shadow-xl mb-6">
                        <Check className="w-16 h-16 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 mb-3">¡Gracias!</h1>
                    <p className="text-xl text-slate-600 max-w-lg">
                        Tu visita fue registrada. El director la revisará y la familia recibirá una notificación cuando se publique.
                    </p>
                    <p className="text-sm text-slate-400 mt-8">Esta pantalla se reiniciará en unos segundos…</p>
                </div>
            )}
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-lg font-bold text-slate-800">{value}</p>
        </div>
    );
}
