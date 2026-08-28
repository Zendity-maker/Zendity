"use client";

import { useEffect, useState } from "react";
import { use } from "react";

/**
 * Encuesta de servicio para la familia. Pública, sin sesión.
 *
 * Tres preguntas y un comentario. Nada más — una encuesta que pide diez cosas
 * se contesta la mitad de las veces que una que pide tres.
 *
 * Las tres dimensiones ya estaban definidas en el modelo desde hace meses
 * (Cuidado, Limpieza, Salud); lo único que faltaba era el sitio para
 * contestarlas, y por eso hay cero respuestas.
 */
const PREGUNTAS = [
    { clave: "cuidado" as const, titulo: "El cuidado que recibe", ayuda: "Trato, atención y acompañamiento del personal." },
    { clave: "limpieza" as const, titulo: "La limpieza", ayuda: "Habitación, áreas comunes e higiene personal." },
    { clave: "salud" as const, titulo: "La atención de salud", ayuda: "Medicamentos, seguimiento clínico y comunicación." },
];

function Estrellas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
    return (
        <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(n)}
                    aria-label={`${n} de 5`}
                    className={`w-11 h-11 rounded-xl text-2xl leading-none transition-all ${
                        n <= valor ? "bg-amber-100 text-amber-500 scale-105" : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                    }`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

export default function EncuestaPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [info, setInfo] = useState<any>(null);
    const [notas, setNotas] = useState({ cuidado: 0, limpieza: 0, salud: 0 });
    // Un comentario por dimensión. Saber en cuál de las tres está el problema
    // es la diferencia entre poder actuar y solo enterarse.
    const [textos, setTextos] = useState({ cuidado: "", limpieza: "", salud: "" });
    const [comentario, setComentario] = useState("");
    const [favorito, setFavorito] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [listo, setListo] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/encuesta/${token}`)
            .then(r => r.json())
            .then(setInfo)
            .catch(() => setInfo({ valido: false }));
    }, [token]);

    const completa = notas.cuidado > 0 && notas.limpieza > 0 && notas.salud > 0;

    const enviar = async () => {
        if (!completa || enviando) return;
        setEnviando(true);
        setError(null);
        try {
            const r = await fetch(`/api/encuesta/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...notas,
                    comentarioCuidado: textos.cuidado,
                    comentarioLimpieza: textos.limpieza,
                    comentarioSalud: textos.salud,
                    comentario,
                    cuidadorFavoritoId: favorito || undefined,
                }),
            });
            const d = await r.json();
            if (!d.success) { setError(d.error || "No se pudo enviar."); return; }
            setListo(true);
        } catch {
            setError("No se pudo enviar. Intenta de nuevo.");
        } finally { setEnviando(false); }
    };

    if (!info) return null;

    if (!info.valido) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <p className="text-slate-500 font-medium text-center">Este enlace no es válido.</p>
            </div>
        );
    }

    if (listo || info.yaRespondida) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                    <p className="text-5xl mb-4">🙏</p>
                    <h1 className="text-2xl font-black text-slate-800 mb-2">Gracias</h1>
                    <p className="text-slate-500 leading-relaxed">
                        {listo
                            ? "Tu respuesta quedó registrada. La dirección del hogar la va a leer."
                            : "Esta encuesta ya fue respondida."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-6">
            <div className="max-w-lg mx-auto">
                <p className="text-xs font-black tracking-[0.2em] text-teal-700 uppercase mb-2">{info.sede}</p>
                <h1 className="text-2xl font-black text-slate-800 mb-2">¿Cómo lo estamos haciendo?</h1>
                <p className="text-slate-500 leading-relaxed mb-8">
                    Tres preguntas sobre el cuidado de <strong className="text-slate-700">{info.residente}</strong>.
                    Toma menos de un minuto y nos ayuda a mejorar.
                </p>

                <div className="space-y-5">
                    {PREGUNTAS.map(p => (
                        <div key={p.clave} className="bg-white border border-slate-200 rounded-2xl p-5">
                            <p className="font-black text-slate-800">{p.titulo}</p>
                            <p className="text-sm text-slate-400 mb-4">{p.ayuda}</p>
                            <Estrellas
                                valor={notas[p.clave]}
                                onChange={n => setNotas(s => ({ ...s, [p.clave]: n }))}
                            />
                            {/* La caja aparece al puntuar: pedirla antes añade
                                ruido a un formulario que se contesta en un
                                minuto. Una vez puntuado, es el momento natural
                                de explicar el porqué. */}
                            {notas[p.clave] > 0 && (
                                <textarea
                                    value={textos[p.clave]}
                                    onChange={e => setTextos(s => ({ ...s, [p.clave]: e.target.value }))}
                                    rows={2}
                                    placeholder={notas[p.clave] <= 3 ? "¿Qué pasó? (opcional)" : "¿Algo que destacar? (opcional)"}
                                    className="w-full mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            )}
                        </div>
                    ))}

                    {/* Cuidadora destacada. Opcional a propósito: obligarlo
                        convertiría la encuesta en un concurso y forzaría a
                        nombrar a alguien aunque no haya destacado nadie. */}
                    {info.cuidadoras?.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5">
                            <p className="font-black text-slate-800">¿Alguien del equipo a quien destacar?</p>
                            <p className="text-sm text-slate-400 mb-3">
                                Opcional. Si alguien ha tratado especialmente bien a {info.residente}, díganoslo.
                            </p>
                            <select
                                value={favorito}
                                onChange={e => setFavorito(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">— Prefiero no señalar a nadie —</option>
                                {info.cuidadoras.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                        <p className="font-black text-slate-800">¿Algo más?</p>
                        <p className="text-sm text-slate-400 mb-3">Lo que no entre en las tres preguntas de arriba.</p>
                        <textarea
                            value={comentario}
                            onChange={e => setComentario(e.target.value)}
                            rows={4}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                </div>

                {error && (
                    <p className="mt-4 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>
                )}

                <button
                    onClick={enviar}
                    disabled={!completa || enviando}
                    className="w-full mt-6 py-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-colors"
                >
                    {enviando ? "Enviando…" : completa ? "Enviar" : "Puntúa las tres preguntas"}
                </button>

                {/* Identificada por decision de Andres. Se dice, no se esconde:
                    una familia que cree responder en anonimo y descubre que no,
                    no vuelve a responder. */}
                <p className="text-center text-xs text-slate-400 mt-4">
                    Tu respuesta llega identificada a la dirección del hogar.
                </p>
            </div>
        </div>
    );
}
