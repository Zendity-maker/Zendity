"use client";

import { useState, useEffect, useRef } from "react";
import { Megaphone, ImagePlus, X, Send, Users, Sparkles, CheckCircle2 } from "lucide-react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export default function FamilyBroadcastPage() {
    const [content, setContent] = useState("");
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [familyCount, setFamilyCount] = useState<number | null>(null);
    const [sending, setSending] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Obtener conteo de familias al cargar
    useEffect(() => {
        fetch('/api/corporate/family-broadcast')
            .then(r => r.json())
            .then(d => { if (d.success) setFamilyCount(d.count); })
            .catch(() => {});
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setImageError(null);
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_IMAGE_BYTES) {
            setImageError("La imagen supera 2 MB. Elige una más pequeña.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setImageBase64(reader.result as string);
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setImageBase64(null);
        setImageError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleImprove = async () => {
        if (!content.trim() || isImproving) return;
        setIsImproving(true);
        try {
            const res = await fetch('/api/care/zendi/improve-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: content, context: 'family_broadcast' }),
            });
            const data = await res.json();
            if (data.success && data.improved) setContent(data.improved);
        } catch { /* no-fatal */ }
        finally { setIsImproving(false); }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || sending) return;
        setSending(true);
        setResult(null);
        try {
            const res = await fetch('/api/corporate/family-broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content.trim(), imageBase64 }),
            });
            const data = await res.json();
            if (data.success) {
                setResult({ ok: true, msg: data.message });
                setContent("");
                removeImage();
            } else {
                setResult({ ok: false, msg: data.error || 'Error al enviar' });
            }
        } catch {
            setResult({ ok: false, msg: 'Error de conexión. Intenta nuevamente.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-teal-500 rounded-2xl flex items-center justify-center shadow-md shadow-teal-200">
                    <Megaphone className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-extrabold text-slate-900 leading-tight">Mensaje a Todas las Familias</h1>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Broadcast institucional — portal familiar + email</p>
                </div>
            </div>

            {/* Contador familias */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <Users className="w-4 h-4 text-teal-600 flex-shrink-0" />
                {familyCount === null ? (
                    <span className="text-sm text-slate-400">Calculando destinatarios…</span>
                ) : familyCount === 0 ? (
                    <span className="text-sm text-amber-600 font-semibold">No hay familiares registrados en esta sede.</span>
                ) : (
                    <span className="text-sm font-semibold text-slate-700">
                        <span className="text-teal-600 font-black">{familyCount}</span>{' '}
                        {familyCount === 1 ? 'familiar registrado recibirá' : 'familias registradas recibirán'} este mensaje
                    </span>
                )}
            </div>

            {/* Éxito o error */}
            {result && (
                <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 ${
                    result.ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                }`}>
                    {result.ok
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                    <p className={`text-sm font-semibold ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                        {result.msg}
                    </p>
                </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSend} className="bg-white rounded-3xl border border-slate-100 shadow-sm shadow-slate-100/60 p-5 space-y-5">

                {/* Textarea */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                        Mensaje
                    </label>
                    <textarea
                        rows={6}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Escribe tu mensaje para todas las familias…"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal resize-none"
                    />
                    {/* Botón Zendi */}
                    {content.length > 10 && (
                        <div className="flex justify-end mt-2">
                            <button
                                type="button"
                                onClick={handleImprove}
                                disabled={isImproving}
                                className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 px-3 py-1.5 rounded-xl border border-teal-200 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                            >
                                {isImproving ? (
                                    <>
                                        <span className="animate-spin inline-block w-3 h-3 border border-teal-400 border-t-transparent rounded-full" />
                                        Mejorando…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5" />
                                        ✨ Mejorar con Zendi
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Upload imagen */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                        Imagen adjunta <span className="font-normal normal-case text-slate-400">(opcional · max 2 MB)</span>
                    </label>

                    {imageBase64 ? (
                        /* Preview */
                        <div className="relative inline-block">
                            <img
                                src={imageBase64}
                                alt="Preview"
                                className="rounded-2xl max-h-56 max-w-full object-cover border border-slate-100 shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={removeImage}
                                className="absolute top-2 right-2 bg-white border border-slate-200 rounded-full p-1 shadow hover:bg-red-50 hover:border-red-200 transition-colors"
                            >
                                <X className="w-4 h-4 text-slate-600" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2.5 px-4 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/40 transition-all text-sm font-semibold w-full"
                        >
                            <ImagePlus className="w-5 h-5 flex-shrink-0" />
                            <span>Adjuntar imagen</span>
                        </button>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                    />

                    {imageError && (
                        <p className="text-xs text-red-600 font-semibold mt-2">{imageError}</p>
                    )}
                </div>

                {/* Botón enviar */}
                <button
                    type="submit"
                    disabled={!content.trim() || sending || familyCount === 0}
                    className="w-full flex items-center justify-center gap-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl py-4 transition-all active:scale-[.98] shadow-md shadow-teal-200 text-sm uppercase tracking-wider"
                >
                    {sending ? (
                        <>
                            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            Enviando…
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            Enviar a Todas las Familias
                        </>
                    )}
                </button>
            </form>

            {/* Nota informativa */}
            <p className="text-xs text-slate-400 text-center leading-relaxed px-2">
                El mensaje se entregará por el portal familiar y por correo electrónico a todos los familiares con acceso registrado en esta sede.
            </p>
        </div>
    );
}
