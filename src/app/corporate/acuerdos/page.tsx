"use client";

import { useEffect, useState } from "react";

/**
 * Configuración → Acuerdos. Donde el director firma el BAA de su sede.
 *
 * Sin este acuerdo, Zéndity no puede recibir información de salud de ningún
 * residente: el candado de /lib/acuerdos-sede.ts bloquea la creación del primer
 * expediente. Esta pantalla es la salida de ese bloqueo, y el mensaje del
 * bloqueo apunta aquí. Se llega por el menú lateral → Acuerdos.
 *
 * Se construyó primero sin enlace en el menú y había que escribir la URL a
 * mano — un candado que bloquea admisiones tiene que tener su salida a la
 * vista, o el bloqueo se vuelve un callejón sin salida.
 *
 * La firma es el nombre tecleado más el cargo, con fecha e IP. No hay casilla de
 * "acepto": una casilla no dice QUIÉN aceptó, y eso es justo lo que hace falta
 * si algún día alguien pregunta.
 */
export default function AcuerdosPage() {
    const [data, setData] = useState<any>(null);
    const [cargando, setCargando] = useState(true);
    const [nombre, setNombre] = useState("");
    const [cargo, setCargo] = useState("");
    const [leido, setLeido] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [aviso, setAviso] = useState<{ t: "ok" | "err"; m: string } | null>(null);

    const cargar = async () => {
        try {
            const res = await fetch("/api/corporate/acuerdos");
            const d = await res.json();
            if (d.success) setData(d);
            else setAviso({ t: "err", m: d.error });
        } finally {
            setCargando(false);
        }
    };
    useEffect(() => { cargar(); }, []);

    const firmar = async () => {
        setEnviando(true);
        try {
            const res = await fetch("/api/corporate/acuerdos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tipo: "BAA", firmanteNombre: nombre, firmanteCargo: cargo }),
            });
            const d = await res.json();
            if (d.success) { setAviso({ t: "ok", m: "Acuerdo firmado. La sede ya puede recibir residentes." }); cargar(); }
            else setAviso({ t: "err", m: d.error });
        } catch {
            setAviso({ t: "err", m: "Error de conexión" });
        } finally {
            setEnviando(false);
        }
    };

    if (cargando) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Cargando acuerdos…</div>;
    if (!data) return <div className="p-10 text-center font-bold text-rose-600">{aviso?.m ?? "No se pudo cargar"}</div>;

    const ya = data.aceptado;

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6 pb-16">
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Acuerdos · {data.sede.nombre}</p>
                <h1 className="text-3xl font-black text-slate-800 mt-1">{data.baa.titulo}</h1>
                <p className="text-slate-500 font-medium mt-2 text-sm">Versión {data.baa.version}</p>
            </div>

            {ya ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                    <p className="text-sm font-black uppercase tracking-wide text-emerald-700 mb-1">Firmado</p>
                    <p className="text-slate-700 font-medium">
                        Aceptado por <strong>{ya.firmanteNombre}</strong>
                        {ya.firmanteCargo ? `, ${ya.firmanteCargo}` : ""} el{" "}
                        {new Date(ya.aceptadoEn).toLocaleDateString("es-PR", { day: "2-digit", month: "long", year: "numeric" })}.
                    </p>
                    <p className="text-[13px] text-emerald-800/70 mt-2">
                        Esta sede puede recibir residentes. Si el acuerdo cambia de versión, se pedirá firmar la nueva.
                    </p>
                </div>
            ) : (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
                    <p className="text-sm font-black uppercase tracking-wide text-amber-700 mb-1">Pendiente de firma</p>
                    <p className="text-slate-700 font-medium leading-relaxed">
                        Mientras este acuerdo no esté firmado, esta sede <strong>no puede registrar residentes</strong>.
                        Zéndity no puede recibir información de salud sin él: es un requisito de HIPAA y protege
                        al hogar tanto como a la persona que vive aquí.
                    </p>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-5 max-h-[520px] overflow-y-auto"
                 onScroll={(e) => {
                     const el = e.currentTarget;
                     if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) setLeido(true);
                 }}>
                {data.baa.secciones.map((s: any, i: number) => (
                    <div key={i}>
                        <h2 className="font-black text-[#0F6E56] text-[15px] mb-1.5">{i + 1}. {s.titulo}</h2>
                        <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-line">{s.cuerpo}</p>
                    </div>
                ))}
            </div>

            {!ya && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <div>
                        <p className="font-black text-slate-800">Firma</p>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Escribe tu nombre completo tal como aparece en documentos. Queda registrado con la fecha.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                        <input
                            value={nombre} onChange={(e) => setNombre(e.target.value)}
                            placeholder="Nombre completo"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                        />
                        <input
                            value={cargo} onChange={(e) => setCargo(e.target.value)}
                            placeholder="Cargo (ej. Dueño, Administradora)"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                        />
                    </div>
                    {!leido && (
                        <p className="text-[13px] font-bold text-amber-700">
                            Desplázate hasta el final del acuerdo antes de firmar.
                        </p>
                    )}
                    <button
                        onClick={firmar}
                        disabled={enviando || !leido || !nombre.trim() || !cargo.trim()}
                        className="w-full py-4 rounded-2xl bg-[#0F6E56] hover:bg-[#0d5a48] disabled:opacity-40 text-white font-black text-lg transition-colors"
                    >
                        {enviando ? "Registrando…" : "Firmar acuerdo"}
                    </button>
                </div>
            )}

            {/* Exportar — el BAA promete "devolverá al Hogar toda la PHI en un
                formato utilizable y legible" y sesenta días de acceso incluso por
                impago. Hasta hoy no existía forma de hacerlo. La información es
                del hogar: se descarga sin pedirle permiso a nadie. */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="font-black text-slate-800">Tu información</p>
                <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                    Los expedientes de tus residentes, sus medicamentos, planes de cuido, caídas y
                    úlceras. Es información del hogar y puedes descargarla cuando quieras — este
                    acuerdo lo garantiza, incluso si algún día dejas de usar Zéndity.
                </p>
                <a
                    href="/api/corporate/exportar"
                    className="inline-block mt-4 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm transition-colors"
                >
                    Descargar toda mi información
                </a>
            </div>

            {aviso && (
                <div className={`rounded-xl p-4 font-bold text-sm ${aviso.t === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
                    {aviso.m}
                </div>
            )}
        </div>
    );
}
