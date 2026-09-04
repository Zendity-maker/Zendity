"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FaCheck, FaTimes, FaRedo } from "react-icons/fa";

const INACTIVITY_MS = 60_000; // 60s para reset automático

// ─── Tipos ──────────────────────────────────────────────────────────────────
type KioskStep = 'welcome' | 'asking-resident' | 'confirming-resident' | 'asking-name' | 'signing' | 'done'
    | 'salida-nombre' | 'salida-hecha';

/** Visita abierta que el kiosco puede cerrar. */
interface VisitaAbierta {
    id: string;
    visitorName: string;
    residentName: string | null;
    visitedAt: string;
    departedAt?: string | null;
}

interface VisitData {
    residentName: string;
    visitorName: string;
    visitorRelation: string;
    patientId: string | null;
}

// ─── Token de dispositivo ────────────────────────────────────────────────────
// Espejo de /external-kiosk: el token de la tablet vive en localStorage bajo
// "zendity_kiosk_token" y viaja como x-device-token en cada petición.
//
// La fase 1 lo enviaba pero el backend lo ignoraba —"backend tolerante"— y esa
// fase 2 nunca llegó. El resultado, comprobado en producción el 04-sep-2026:
// /api/reception/search-resident respondía 200 sin ninguna credencial, con
// nombres y números de cuarto. Los tres endpoints ya EXIGEN el token.
//
// Las dos tablets comparten la llave, así que una configurada por
// /external-kiosk/setup vale también para recepción.
const KIOSK_TOKEN_KEY = "zendity_kiosk_token";

function kioskDeviceHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = window.localStorage.getItem(KIOSK_TOKEN_KEY);
    return token ? { "x-device-token": token } : {};
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function ReceptionKiosk() {
    // El `?hqId=` de la URL del kiosco ya no se lee: la sede sale del token de
    // la tablet. El parámetro sigue en el enlace del QR y es inofensivo —lo
    // ignora el cliente y lo ignora el servidor.

    const [step, setStep] = useState<KioskStep>("welcome");
    // Arranca en null, NO en "Zéndity". Este kiosco está en el lobby de un
    // hogar y se presenta como el hogar; el proveedor del software va en letra
    // pequeña al pie, si acaso.
    const [hqName, setHqName] = useState<string | null>(null);

    /**
     * Paleta de LA SEDE, no de Zéndity.
     *
     * `brandPrimary/Secondary/Accent/Bg` viven en Headquarters y las dos sedes
     * de Vivid ya los tienen puestos. El kiosco los pide junto con el nombre y
     * los aplica como variables CSS, así que un hogar ajeno a Vivid se pinta
     * con los suyos sin tocar una línea.
     *
     * El respaldo es el de Vivid porque es quien lo usa hoy; si la llamada
     * falla, la tablet se ve bien igual.
     */
    const [colores, setColores] = useState({
        primary: '#1C3170', secondary: '#8CBBE8', accent: '#C5E69A', bg: '#FAF6EE',
    });
    const bienvenidaDicha = useRef(false);
    const [sinAutorizar, setSinAutorizar] = useState(false);

    // ── Salida ───────────────────────────────────────────────────────────────
    // El visitante escribe SU nombre y se le devuelven solo sus visitas
    // abiertas de hoy. No se enseña la lista completa: seria decirle a
    // cualquiera que pase por el lobby quien esta dentro y a quien vino a ver.
    const [salidaNombre, setSalidaNombre] = useState("");
    const [salidaCandidatas, setSalidaCandidatas] = useState<VisitaAbierta[]>([]);
    const [salidaBuscando, setSalidaBuscando] = useState(false);
    const [salidaHecha, setSalidaHecha] = useState<VisitaAbierta | null>(null);
    const [salidaError, setSalidaError] = useState<string | null>(null);

    const buscarSalida = async () => {
        const nombre = salidaNombre.trim();
        if (nombre.length < 3 || salidaBuscando) return;
        setSalidaBuscando(true);
        setSalidaError(null);
        try {
            const res = await fetch(`/api/reception/salida?nombre=${encodeURIComponent(nombre)}`, {
                headers: kioskDeviceHeaders(),
            });
            const data = await res.json();
            const vs = data.visitas ?? [];
            setSalidaCandidatas(vs);
            if (vs.length === 0) {
                setSalidaError('No encontramos una visita abierta a ese nombre. Avise al personal.');
            } else if (vs.length === 1) {
                await confirmarSalida(vs[0].id);
            }
        } catch {
            setSalidaError('Error de conexión.');
        } finally {
            setSalidaBuscando(false);
        }
    };

    const confirmarSalida = async (visitId: string) => {
        setSalidaBuscando(true);
        setSalidaError(null);
        try {
            const res = await fetch('/api/reception/salida', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...kioskDeviceHeaders() },
                body: JSON.stringify({ visitId }),
            });
            const data = await res.json();
            if (data.success) {
                setSalidaHecha(data.visita);
                setStep('salida-hecha');
                speak('Gracias por su visita. Que tenga buen día.');
            } else {
                setSalidaError(data.error || 'No se pudo registrar la salida.');
            }
        } catch {
            setSalidaError('Error de conexión.');
        } finally {
            setSalidaBuscando(false);
        }
    };

    // Display states (usados en JSX para mostrar nombres)
    const [residentName, setResidentName] = useState("");
    const [visitorName, setVisitorName] = useState("");
    const [visitorRelation, setVisitorRelation] = useState("");

    // Input en asking-resident (antes de confirmar)
    const [inputText, setInputText] = useState("");

    // Datos confirmados para el API (incluye patientId)
    const [visitData, setVisitData] = useState<VisitData>({
        residentName: "", visitorName: "", visitorRelation: "", patientId: null
    });

    // Candidatos al buscar residente
    const [residentCandidates, setResidentCandidates] = useState<any[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [visitId, setVisitId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Canvas firma
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasWrapRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const [hasSigned, setHasSigned] = useState(false);
    const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 480, height: 180 });

    // Inactividad — resetea a welcome tras INACTIVITY_MS sin actividad
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Referencia al reconocedor activo (para poder detenerlo)

    // Referencia al audio activo de ElevenLabs (para cancelar duplicación)
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Ref para evitar duplicación de anuncio en asking-name
    const nameStepAnnouncedRef = useRef(false);

    // ── Voz TTS — ElevenLabs con fallback Web Speech ─────────────────────────
    const speak = useCallback((text: string, onEnd?: () => void) => {
        // Cancelar audio anterior si existe
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        window.speechSynthesis.cancel();

        const playWithElevenLabs = async () => {
            try {
                setIsSpeaking(true);
                // El token va aquí también: el kiosco no tiene sesión de
                // nadie, y sin credencial /api/zendi/speak devuelve 401 y la
                // tablet se queda muda. Si falla, cae a la voz del navegador.
                const res = await fetch('/api/zendi/speak', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...kioskDeviceHeaders() },
                    body: JSON.stringify({ text })
                });

                if (!res.ok) throw new Error('ElevenLabs failed');

                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audioRef.current = audio;

                audio.onended = () => {
                    audioRef.current = null;
                    setIsSpeaking(false);
                    URL.revokeObjectURL(url);
                    if (onEnd) onEnd();
                };

                audio.onerror = () => {
                    audioRef.current = null;
                    setIsSpeaking(false);
                    URL.revokeObjectURL(url);
                    if (onEnd) onEnd();
                };

                await audio.play();

            } catch (e) {
                console.warn('[Zendi] ElevenLabs falló, usando Web Speech API:', e);
                // Fallback a Web Speech API
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-US';
                utterance.rate = 0.88;
                utterance.pitch = 1.08;
                const voices = window.speechSynthesis.getVoices();
                const preferred = voices.find(v => v.lang.startsWith('es') && !v.localService)
                    || voices.find(v => v.lang.startsWith('es'));
                if (preferred) utterance.voice = preferred;
                utterance.onstart = () => setIsSpeaking(true);
                utterance.onend = () => { setIsSpeaking(false); if (onEnd) onEnd(); };
                window.speechSynthesis.speak(utterance);
            }
        };

        playWithElevenLabs();
    }, []);

    // ── STT ──────────────────────────────────────────────────────────────────
    // El dictado se retiró el 04-sep-2026. Andrés lo probó en la tablet: no
    // oía bien. Es el peor caso posible para reconocimiento de voz —apellidos
    // puertorriqueños, dichos por gente mayor, en un lobby con ruido— y es
    // donde menos se puede fallar: un nombre mal oído archiva la visita contra
    // el residente equivocado.
    //
    // Además el kiosco abría el micrófono SOLO, sin que nadie lo pidiera, en un
    // área común donde el personal habla de residentes. Ese audio salía del
    // edificio hacia el servicio de reconocimiento del navegador y nadie había
    // consentido nada. Un micrófono que se enciende solo en el lobby de un
    // sistema con PHI es difícil de justificar.
    //
    // Y `startListening` lanzaba un alert() nativo cuando el navegador no
    // soportaba la API — llamado automáticamente en SEIS puntos del flujo: un
    // popup por paso en cualquier tablet sin soporte.
    //
    // La VOZ DE ZENDI se queda: guía hablando, el visitante escribe.


    // ── Búsqueda y confirmación de residente ─────────────────────────────────
    const handleResidentConfirm = async () => {
        const name = inputText.trim();
        if (!name) return;

        try {
            // Sin `hqId`: la sede la pone el token de la tablet.
            const res = await fetch(`/api/reception/search-resident?q=${encodeURIComponent(name)}`, {
                headers: kioskDeviceHeaders(),
            });
            const data = await res.json();

            if (data.patients?.length === 1) {
                const patient = data.patients[0];
                setResidentName(patient.name);
                nameStepAnnouncedRef.current = true;
                setVisitData(prev => ({ ...prev, residentName: patient.name, patientId: patient.id }));
                setInputText('');
                setStep('asking-name');
                speak(`¿Viene a visitar a ${patient.name}? Perfecto. ¿Me puede dar su nombre completo?`);
            } else if (data.patients?.length > 1) {
                setResidentCandidates(data.patients);
                setStep('confirming-resident');
                const names = data.patients.slice(0, 3).map((p: any) => p.name).join(', ');
                speak(`Encontré varios residentes. ¿Viene a visitar a ${names}? Por favor seleccione en la pantalla.`);
            } else {
                setResidentName(name);
                nameStepAnnouncedRef.current = true;
                setVisitData(prev => ({ ...prev, residentName: name, patientId: null }));
                setInputText('');
                setStep('asking-name');
                speak(`De acuerdo. ¿Me puede dar su nombre completo?`);
            }
        } catch {
            setResidentName(name);
            nameStepAnnouncedRef.current = true;
            setVisitData(prev => ({ ...prev, residentName: name, patientId: null }));
            setStep('asking-name');
            speak(`¿Me puede dar su nombre completo?`);
        }
    };

    const handleResidentSelect = (patient: any) => {
        setResidentName(patient.name);
        nameStepAnnouncedRef.current = true;
        setVisitData(prev => ({ ...prev, residentName: patient.name, patientId: patient.id }));
        setResidentCandidates([]);
        setInputText('');
        setStep('asking-name');
        speak(`Perfecto. Visita para ${patient.name}. ¿Me puede dar su nombre completo?`);
    };

    // ── Identidad de la sede, y de paso comprobación del token ───────────────
    //
    // La sede ya no sale del `?hqId=` de la URL sino del dispositivo, así que
    // esta llamada sirve para dos cosas: traer el nombre y averiguar si la
    // tablet está autorizada. Un 401 aquí significa que no lo está, y hay que
    // DECIRLO: antes, sin token, el kiosco se veía normal y luego no
    // encontraba a nadie, que es la peor forma de fallar.
    useEffect(() => {
        fetch('/api/reception/hq-info', { headers: kioskDeviceHeaders() })
            .then(async r => {
                if (r.status === 401) { setSinAutorizar(true); return; }
                const d = await r.json();
                if (d?.name) setHqName(d.name);
                if (d?.colores) setColores(c => ({ ...c, ...d.colores }));
            })
            .catch(() => {
                // Sin red no se puede saber de quién es la casa. Se saluda sin
                // nombrar a nadie antes que nombrar a quien no es.
                if (!bienvenidaDicha.current) {
                    bienvenidaDicha.current = true;
                    setTimeout(() => speak('Bienvenido. Soy Zendi, su asistente de recepción.'), 800);
                }
            });
    }, []);

    // ── Bienvenida — espera a saber de quién es la casa ─────────────────────
    //
    // Antes esto corría con `[]` de dependencias y un temporizador de 800 ms,
    // así que la clausura capturaba el `hqName` inicial y lo decía SIEMPRE, sin
    // importar cuándo llegara el nombre real: "Bienvenido a Zéndity. Soy Zendi,
    // su asistente de recepción." No era una carrera que a veces se perdía —
    // se perdía todas las veces.
    //
    // Ahora depende de `hqName` y solo habla cuando hay uno. El ref evita que
    // repita el saludo si el nombre volviera a cambiar.
    useEffect(() => {
        if (!hqName || bienvenidaDicha.current) return;
        bienvenidaDicha.current = true;
        const timer = setTimeout(() => {
            speak(`Bienvenido a ${hqName}. Soy Zendi, su asistente de recepción.`);
        }, 800);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hqName]);

    // ── Flujo de pasos — nunca incluir 'welcome' ────────────────────────────
    useEffect(() => {
        if (step === 'asking-resident') {
            speak('¿A quién viene a visitar hoy?');
        } else if (step === 'asking-name') {
            if (nameStepAnnouncedRef.current) {
                // Ya fue anunciado por handleResidentConfirm — solo resetear el ref
                nameStepAnnouncedRef.current = false;
            } else {
                // Llegó aquí por otra vía — hablar normalmente
                speak('¿Me puede dar su nombre completo?');
            }
        } else if (step === 'signing') {
            speak(`Gracias ${visitData.visitorName}. Por favor firme su visita en la pantalla mientras le notifico al personal.`);
        } else if (step === 'done') {
            speak(`Visita registrada. ¡Que disfrute su visita con ${visitData.residentName}!`);
            const timer = setTimeout(() => {
                setStep('welcome');
                setResidentName('');
                setVisitorName('');
                setVisitorRelation('');
                setInputText('');
                setHasSigned(false);
                setVisitId(null);
                setErrorMsg(null);
                setResidentCandidates([]);
                setVisitData({ residentName: '', visitorName: '', visitorRelation: '', patientId: null });
                clearCanvas();
            }, 8000);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]); // Solo reacciona a cambios de step, nunca a 'welcome'

    // ── FIX 4: Timeout de inactividad ────────────────────────────────────────
    // Cualquier actividad (click/touch/key/change) reinicia el timer.
    // Si no hay actividad en 60s y el step es intermedio, reset a 'welcome'.
    const handleInactivityReset = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        window.speechSynthesis.cancel();

        setStep('welcome');
        setResidentName('');
        setVisitorName('');
        setVisitorRelation('');
        setInputText('');
        setHasSigned(false);
        setVisitId(null);
        setErrorMsg(null);
        setResidentCandidates([]);
        setVisitData({ residentName: '', visitorName: '', visitorRelation: '', patientId: null });
        nameStepAnnouncedRef.current = false;
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }

        speak('Sesión expirada por inactividad.');
    }, [speak]);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
        // Solo armar el timer en pasos intermedios
        if (step === 'welcome' || step === 'done') return;
        inactivityTimerRef.current = setTimeout(handleInactivityReset, INACTIVITY_MS);
    }, [step, handleInactivityReset]);

    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
                inactivityTimerRef.current = null;
            }
        };
    }, [step, resetInactivityTimer]);

    // ── FIX 5: Canvas firma responsive ───────────────────────────────────────
    useEffect(() => {
        const measure = () => {
            const wrap = canvasWrapRef.current;
            if (!wrap) return;
            const parentWidth = wrap.clientWidth;
            const width = Math.max(240, Math.min(parentWidth - 32, 600));
            const height = Math.round(width * 0.35);
            setCanvasSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
        };
        // Medir al montar y en cada resize (si el canvas ya está montado)
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, [step]); // remeasure cuando entramos/salimos del paso signing

    // Al cambiar de tamaño el canvas, se resetea el buffer → limpiar estado
    useEffect(() => {
        setHasSigned(false);
    }, [canvasSize.width, canvasSize.height]);

    // ── Canvas Firma ─────────────────────────────────────────────────────────
    const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        if ("touches" in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return;
        e.preventDefault();
        isDrawingRef.current = true;
        lastPosRef.current = getPos(e, canvasRef.current);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const pos = getPos(e, canvasRef.current);
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        lastPosRef.current = pos;
        setHasSigned(true);
    };

    const stopDraw = () => { isDrawingRef.current = false; };

    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasSigned(false);
    };

    // ── Guardar visita ────────────────────────────────────────────────────────
    const handleSignatureSubmit = async () => {
        if (!hasSigned) {
            speak("Por favor firme en la pantalla antes de continuar.");
            return;
        }
        setIsSaving(true);
        setErrorMsg(null);
        try {
            const signature = canvasRef.current?.toDataURL("image/png") || null;
            const res = await fetch("/api/reception/visit", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...kioskDeviceHeaders() },
                body: JSON.stringify({
                    residentName: visitData.residentName || residentName,
                    visitorName: visitData.visitorName || visitorName,
                    visitorRelation: visitData.visitorRelation || visitorRelation,
                    patientId: visitData.patientId || null,
                    // Sin `timestamp`: la hora la pone el servidor. Quien
                    // firma un registro no puede fijar su propia hora.
                    signatureData: signature,
                })
            });
            const data = await res.json();
            if (data.success) {
                setVisitId(data.visit?.id || null);
                setStep("done");
            } else {
                setErrorMsg(data.error || "Error al registrar la visita.");
                speak("Hubo un problema al registrar. Por favor avise al personal.");
            }
        } catch {
            setErrorMsg("Error de conexión.");
        } finally {
            setIsSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    // Tablet sin autorizar. Va ANTES que todo: sin token no se puede buscar a
    // nadie ni registrar nada, y una pantalla de bienvenida normal que luego
    // "no encuentra al residente" haría creer al visitante que la persona no
    // vive aquí. Mejor decir la verdad, y decirle al personal qué hacer.
    if (sinAutorizar) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] text-[#1C3170] flex flex-col items-center justify-center p-8 text-center select-none">
                <div className="max-w-lg">
                    <div className="text-5xl mb-6">🔒</div>
                    <h1 className="text-3xl font-black text-[var(--m-primary)] mb-4">Tablet sin autorizar</h1>
                    <p className="text-[color-mix(in_oklab,var(--m-primary)_85%,white)] text-lg leading-relaxed mb-8">
                        Esta tablet todavía no está registrada como kiosco de este hogar,
                        así que no puede consultar residentes ni anotar visitas.
                    </p>
                    <div className="bg-white border border-[color-mix(in_oklab,var(--m-primary)_18%,transparent)] rounded-2xl p-6 text-left">
                        <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm font-bold uppercase tracking-widest mb-3">Para el personal</p>
                        <p className="text-[var(--m-primary)] leading-relaxed">
                            En Zéndity, entra a <span className="font-bold text-[color-mix(in_oklab,var(--m-primary)_70%,white)]">Kioscos</span>,
                            genera el enlace de configuración de esta tablet y ábrelo aquí una vez.
                            Queda autorizada y no hay que repetirlo.
                        </p>
                    </div>
                    <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm mt-8">
                        Mientras tanto, anota la visita en papel.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            /* Fondo CLARO. El kiosco está junto a una entrada con luz natural y
               una pantalla oscura ahí se convierte en espejo. Además el tema
               oscuro traia 22 usos de `text-slate-500` sobre `slate-900`: unos
               4:1 de contraste, por debajo del mínimo legible para texto
               corrido — y quien lo usa tiene ochenta años. */
            className="min-h-screen flex flex-col items-center justify-center p-6 select-none"
            style={{
                background: colores.bg,
                color: colores.primary,
                ['--m-primary' as string]: colores.primary,
                ['--m-secondary' as string]: colores.secondary,
                ['--m-accent' as string]: colores.accent,
            } as React.CSSProperties}
            onClick={resetInactivityTimer}
            onTouchStart={resetInactivityTimer}
            onKeyDown={resetInactivityTimer}
            onChange={resetInactivityTimer}
        >

            {/* Header */}
            <div className="w-full max-w-2xl mb-6 text-center">
                <h1 className="text-[var(--m-primary)] font-black text-3xl tracking-wide mb-1">
                    {hqName ?? '\u00A0'}
                </h1>
                <p className="text-[color-mix(in_oklab,var(--m-primary)_70%,white)] text-sm font-medium tracking-widest uppercase">
                    Recepción · Powered by Zéndity
                </p>
            </div>

            {/* ── STEP: WELCOME ── */}
            {step === "welcome" && (
                <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-32 h-32 rounded-full bg-[color-mix(in_oklab,var(--m-accent)_35%,white)] border-2 border-[var(--m-accent)] flex items-center justify-center">
                        <span className="text-6xl">👋</span>
                    </div>
                    <h1 className="text-[var(--m-primary)] text-3xl font-bold text-center leading-snug">
                        ¡Bienvenido!
                    </h1>
                    <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-lg text-center max-w-sm">
                        Regístrese para visitar a un residente de nuestra comunidad.
                    </p>
                    <button
                        onClick={() => setStep("asking-resident")}
                        className="mt-4 bg-[var(--m-accent)] hover:brightness-95 text-[var(--m-primary)] font-black text-xl px-12 py-5 rounded-2xl shadow-lg hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                    >
                        Iniciar Registro
                    </button>
                    {/* La salida va aqui, discreta pero presente. Sin ella el
                        registro no dice quien esta dentro del edificio, que es
                        para lo que sirve en una evacuacion. */}
                    <button
                        onClick={() => { setSalidaNombre(""); setSalidaCandidatas([]); setSalidaError(null); setStep("salida-nombre"); }}
                        className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] hover:text-[var(--m-primary)] text-base font-semibold underline underline-offset-4 px-6 py-3 transition-colors"
                    >
                        Ya me voy — registrar mi salida
                    </button>
                </div>
            )}

            {/* ── PASO: SALIDA — NOMBRE ── */}
            {step === "salida-nombre" && (
                <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <h2 className="text-[var(--m-primary)] text-2xl font-bold text-center">¿Cuál es su nombre?</h2>
                    <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-center text-sm">Para cerrar su visita de hoy.</p>
                    <input
                        type="text"
                        value={salidaNombre}
                        onChange={(e) => { setSalidaNombre(e.target.value); setSalidaError(null); setSalidaCandidatas([]); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') buscarSalida(); }}
                        placeholder="Su nombre completo..."
                        autoFocus
                        className="w-full bg-white border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] text-[var(--m-primary)] text-xl rounded-2xl px-6 py-5 outline-none focus:border-[var(--m-primary)]"
                    />

                    {salidaCandidatas.length > 1 && (
                        <div className="w-full flex flex-col gap-2">
                            <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm text-center">Toque su visita:</p>
                            {salidaCandidatas.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => confirmarSalida(v.id)}
                                    disabled={salidaBuscando}
                                    className="w-full bg-white hover:bg-[color-mix(in_oklab,var(--m-secondary)_18%,white)] border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] rounded-2xl px-5 py-4 text-left transition-colors disabled:opacity-50"
                                >
                                    <span className="block text-[var(--m-primary)] font-bold">{v.visitorName}</span>
                                    <span className="block text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm">
                                        Visitó a {v.residentName} · entró a las{' '}
                                        {new Date(v.visitedAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {salidaError && <p className="text-amber-400 text-center text-sm">{salidaError}</p>}

                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => setStep("welcome")}
                            className="flex-1 bg-white hover:bg-[color-mix(in_oklab,var(--m-primary)_8%,white)] text-[var(--m-primary)] border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] font-bold py-4 rounded-2xl transition-colors"
                        >
                            Volver
                        </button>
                        <button
                            onClick={buscarSalida}
                            disabled={salidaNombre.trim().length < 3 || salidaBuscando}
                            className="flex-1 bg-[var(--m-accent)] hover:brightness-95 text-[var(--m-primary)] font-black py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-40"
                        >
                            {salidaBuscando ? 'Buscando…' : 'Registrar salida'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── PASO: SALIDA REGISTRADA ── */}
            {step === "salida-hecha" && (
                <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-28 h-28 rounded-full bg-[color-mix(in_oklab,var(--m-accent)_35%,white)] border-2 border-[var(--m-accent)] flex items-center justify-center">
                        <span className="text-5xl">👋</span>
                    </div>
                    <h1 className="text-[var(--m-primary)] text-3xl font-bold text-center">Salida registrada</h1>
                    {salidaHecha && (
                        <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-center text-lg leading-relaxed">
                            {salidaHecha.visitorName}, gracias por visitar a {salidaHecha.residentName}.
                            <br />
                            <span className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-base">
                                {new Date(salidaHecha.visitedAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                {' → '}
                                {salidaHecha.departedAt && new Date(salidaHecha.departedAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </p>
                    )}
                    <button
                        onClick={() => { setSalidaHecha(null); setSalidaNombre(""); setStep("welcome"); }}
                        className="mt-2 bg-white hover:bg-[color-mix(in_oklab,var(--m-primary)_8%,white)] text-[var(--m-primary)] border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] font-bold px-10 py-4 rounded-2xl transition-colors"
                    >
                        Listo
                    </button>
                </div>
            )}

            {/* ── STEP: ASKING RESIDENT ── */}
            {step === "asking-resident" && (
                <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <StepIndicator current={1} total={3} />
                    <h2 className="text-[var(--m-primary)] text-2xl font-bold text-center">¿A quién viene a visitar?</h2>
                    <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-center text-sm">Escriba o diga el nombre del residente.</p>

                    <div className="w-full relative">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Nombre del residente..."
                            className="w-full bg-white border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] text-[var(--m-primary)] text-xl rounded-2xl px-6 py-5 outline-none focus:border-[var(--m-primary)] focus:ring-2 focus:ring-[var(--m-primary)]/30 placeholder:text-[color-mix(in_oklab,var(--m-primary)_80%,white)] font-medium"
                        />
                    </div>


                    <div className="flex gap-4 w-full mt-2">
                        <button onClick={() => setStep("welcome")} className="flex-1 bg-white hover:bg-[color-mix(in_oklab,var(--m-primary)_8%,white)] text-[var(--m-primary)] border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <FaTimes /> Cancelar
                        </button>
                        <button
                            onClick={handleResidentConfirm}
                            disabled={!inputText.trim()}
                            className="flex-1 bg-[var(--m-accent)] hover:brightness-95 disabled:opacity-40 disabled:pointer-events-none text-[var(--m-primary)] font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            Buscar <FaCheck />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: CONFIRMING RESIDENT ── */}
            {step === 'confirming-resident' && (
                <div className="w-full max-w-2xl">
                    <div className="bg-white rounded-2xl p-6 mb-6 border-2 border-[var(--m-accent)]">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-[var(--m-accent)] rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-[var(--m-primary)] text-sm font-bold">Z</span>
                            </div>
                            <div>
                                <p className="text-[color-mix(in_oklab,var(--m-primary)_70%,white)] text-xs font-bold mb-1">ZENDI</p>
                                <p className="text-[var(--m-primary)] text-xl font-medium">¿A cuál de estos residentes viene a visitar?</p>
                                <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm mt-1">Which resident are you visiting?</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {residentCandidates.map((patient: any) => (
                            <button
                                key={patient.id}
                                onClick={() => handleResidentSelect(patient)}
                                className="w-full flex items-center justify-between bg-white hover:bg-[color-mix(in_oklab,var(--m-secondary)_18%,white)] border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] hover:border-[var(--m-primary)] rounded-2xl px-6 py-4 transition-all text-left"
                            >
                                <div>
                                    <p className="text-[var(--m-primary)] font-bold text-lg">{patient.name}</p>
                                    {patient.room && <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm">Cuarto {patient.room}</p>}
                                </div>
                                <span className="text-[color-mix(in_oklab,var(--m-primary)_70%,white)] text-2xl">→</span>
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                setResidentCandidates([]);
                                setStep('asking-resident');
                                setInputText('');
                                                speak('Por favor intente de nuevo con el nombre completo del residente.');
                            }}
                            className="w-full py-3 text-[color-mix(in_oklab,var(--m-primary)_72%,white)] hover:text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm transition-colors"
                        >
                            Ninguno — intentar de nuevo
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: ASKING NAME ── */}
            {step === "asking-name" && (
                <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <StepIndicator current={2} total={3} />
                    <h2 className="text-[var(--m-primary)] text-2xl font-bold text-center">¿Cuál es su nombre?</h2>
                    <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-center text-sm">
                        Visitando a: <span className="text-[color-mix(in_oklab,var(--m-primary)_70%,white)] font-bold">{residentName}</span>
                    </p>

                    <div className="w-full space-y-3">
                        <div className="relative">
                            <input
                                type="text"
                                value={visitorName}
                                onChange={(e) => setVisitorName(e.target.value)}
                                placeholder="Su nombre completo..."
                                className="w-full bg-white border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] text-[var(--m-primary)] text-xl rounded-2xl px-6 py-5 outline-none focus:border-[var(--m-primary)] focus:ring-2 focus:ring-[var(--m-primary)]/30 placeholder:text-[color-mix(in_oklab,var(--m-primary)_80%,white)] font-medium"
                            />
                        </div>
                        <input
                            type="text"
                            value={visitorRelation}
                            onChange={(e) => setVisitorRelation(e.target.value)}
                            placeholder="Relación (ej. Hijo/a, Cónyuge, Amigo/a)..."
                            className="w-full bg-white border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] text-[var(--m-primary)] text-base rounded-2xl px-6 py-4 outline-none focus:border-[var(--m-primary)] focus:ring-2 focus:ring-[var(--m-primary)]/30 placeholder:text-[color-mix(in_oklab,var(--m-primary)_80%,white)]"
                        />
                    </div>


                    <div className="flex gap-4 w-full mt-2">
                        <button onClick={() => setStep("asking-resident")} className="flex-1 bg-white hover:bg-[color-mix(in_oklab,var(--m-primary)_8%,white)] text-[var(--m-primary)] border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <FaTimes /> Atrás
                        </button>
                        <button
                            onClick={() => {
                                if (visitorName.trim()) {
                                    setVisitData(prev => ({ ...prev, visitorName, visitorRelation }));
                                    setStep("signing");
                                }
                            }}
                            disabled={!visitorName.trim()}
                            className="flex-1 bg-[var(--m-accent)] hover:brightness-95 disabled:opacity-40 disabled:pointer-events-none text-[var(--m-primary)] font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            Continuar <FaCheck />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: SIGNING ── */}
            {step === "signing" && (
                <div className="w-full max-w-lg flex flex-col items-center gap-5 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <StepIndicator current={3} total={3} />
                    <h2 className="text-[var(--m-primary)] text-2xl font-bold text-center">Firme para confirmar</h2>
                    <div className="text-center space-y-0.5">
                        <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm">Visitante: <span className="text-[var(--m-primary)] font-semibold">{visitorName}</span></p>
                        <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm">Residente: <span className="text-[color-mix(in_oklab,var(--m-primary)_70%,white)] font-semibold">{residentName}</span></p>
                    </div>

                    {/* Canvas */}
                    <div ref={canvasWrapRef} className="w-full bg-white rounded-2xl overflow-hidden border-4 border-[color-mix(in_oklab,var(--m-primary)_18%,transparent)] relative">
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            className="w-full touch-none cursor-crosshair"
                            onMouseDown={startDraw}
                            onMouseMove={draw}
                            onMouseUp={stopDraw}
                            onMouseLeave={stopDraw}
                            onTouchStart={startDraw}
                            onTouchMove={draw}
                            onTouchEnd={stopDraw}
                        />
                        {!hasSigned && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-base font-medium opacity-70">Firme aquí ✍️</span>
                            </div>
                        )}
                    </div>

                    <button onClick={clearCanvas} className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] hover:text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm flex items-center gap-1.5 transition-colors">
                        <FaRedo className="text-xs" /> Borrar firma
                    </button>

                    {errorMsg && (
                        <p className="text-rose-400 text-sm text-center">{errorMsg}</p>
                    )}

                    <div className="flex gap-4 w-full">
                        <button onClick={() => setStep("asking-name")} className="flex-1 bg-white hover:bg-[color-mix(in_oklab,var(--m-primary)_8%,white)] text-[var(--m-primary)] border-2 border-[color-mix(in_oklab,var(--m-primary)_25%,transparent)] font-bold py-4 rounded-xl transition-colors">
                            Atrás
                        </button>
                        <button
                            onClick={handleSignatureSubmit}
                            disabled={!hasSigned || isSaving}
                            className="flex-1 bg-[var(--m-accent)] hover:brightness-95 disabled:opacity-40 disabled:pointer-events-none text-[var(--m-primary)] font-black py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registrando...</span>
                            ) : (
                                <><FaCheck /> Confirmar Visita</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: DONE ── */}
            {step === "done" && (
                <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-500 text-center">
                    <div className="w-28 h-28 rounded-full bg-[color-mix(in_oklab,var(--m-accent)_35%,white)] border-2 border-[var(--m-accent)] flex items-center justify-center">
                        <FaCheck className="text-[color-mix(in_oklab,var(--m-primary)_70%,white)] text-4xl" />
                    </div>
                    <h2 className="text-[var(--m-primary)] text-3xl font-black">¡Visita Registrada!</h2>
                    <div className="space-y-1">
                        <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-lg">Bienvenido, <span className="text-[var(--m-primary)] font-bold">{visitorName}</span></p>
                        <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)]">Visita a <span className="text-[color-mix(in_oklab,var(--m-primary)_70%,white)] font-semibold">{residentName}</span> confirmada.</p>
                        {visitId && <p className="text-[color-mix(in_oklab,var(--m-primary)_80%,white)] text-xs mt-2">ID: {visitId}</p>}
                    </div>
                    <p className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-sm mt-4">Esta pantalla se reiniciará en unos segundos...</p>
                </div>
            )}

            {/* Footer */}
            <div className="mt-16 text-[color-mix(in_oklab,var(--m-primary)_55%,white)] text-xs tracking-widest uppercase">
                Zéndity Healthcare Management Platform
            </div>
        </div>
    );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-300 ${
                        i + 1 === current ? "w-8 bg-[var(--m-primary)]" :
                        i + 1 < current ? "w-2 bg-[var(--m-accent)]" :
                        "w-2 bg-[color-mix(in_oklab,var(--m-primary)_8%,white)]"
                    }`}
                />
            ))}
            <span className="text-[color-mix(in_oklab,var(--m-primary)_72%,white)] text-xs ml-1">{current} de {total}</span>
        </div>
    );
}

