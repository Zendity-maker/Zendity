"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import ZendiWidget from "@/components/ZendiWidget";

export default function CorporateAcademyBuilder() {
    const { user } = useAuth();
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [durationMins, setDurationMins] = useState("15");
    const [bonusCompliance, setBonusCompliance] = useState("10");

    useEffect(() => {
        if (user) fetchCourses();
    }, [user]);

    const fetchCourses = async () => {
        try {
            const hqId = user?.hqId || user?.headquartersId;
            const res = await fetch(`/api/academy?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) setCourses(data.catalog);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title || !description) return alert("Completa todos los campos y adjunta un PDF.");

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("hqId", user?.hqId || user?.headquartersId || "");
            formData.append("title", title);
            formData.append("description", description);
            formData.append("durationMins", durationMins);
            formData.append("bonusCompliance", bonusCompliance);

            const res = await fetch("/api/corporate/academy/courses/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                alert("🎉 ¡Curso generado exitosamente por Zendi AI!");
                setFile(null);
                setTitle("");
                setDescription("");
                fetchCourses();
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Fallo de conexión al cargar el PDF.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return <div className="p-8 text-center text-indigo-600 font-bold animate-pulse">Cargando Plataforma...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <img src="/brand/zendity_icon_primary.svg" alt="Zendity Academy Build" className="w-10 h-10 object-contain drop-shadow-sm" />
                        Academy AI Builder
                    </h2>
                    <p className="text-slate-500 mt-1 font-medium">
                        Generador automático de cursos interactivos vía Documentos PDF (Gemini 1.5 Pro)
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Upload Form */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-black text-slate-800 mb-4 border-b border-slate-100 pb-3">Subir Manual Corporativo</h3>
                    <form onSubmit={handleUpload} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Título del Curso</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ej. Protocolo de Evacuación 2026" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Descripción Breve</label>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} placeholder="Instrucciones en caso de emergencias..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"></textarea>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Duración (Mins)</label>
                                <input type="number" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg font-bold text-slate-800" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Puntos Base (Compliance)</label>
                                <input type="number" value={bonusCompliance} onChange={(e) => setBonusCompliance(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg font-bold text-slate-800" />
                            </div>
                        </div>
                        <div className="border-2 border-dashed border-indigo-200 bg-indigo-50 rounded-xl p-6 text-center hover:bg-indigo-100 transition-colors">
                            <input type="file" accept="application/pdf" id="pdfUpload" className="hidden" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} />
                            <label htmlFor="pdfUpload" className="cursor-pointer flex flex-col items-center justify-center">
                                <span className="text-4xl mb-2">📑</span>
                                <span className="text-indigo-700 font-bold mb-1">Haz clic para adjuntar PDF</span>
                                <span className="text-xs text-indigo-500/80 font-medium">{file ? file.name : "Formatos soportados: .pdf (Documentos con texto)"}</span>
                            </label>
                        </div>
                        
                        <button type="submit" disabled={submitting || !file} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all flex justify-center items-center gap-2">
                            {submitting ? "🤖 Zendi Extrayendo PDFs..." : "Generar Curso Oficial"}
                        </button>
                    </form>
                </div>

                {/* Directorio de Cursos */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
                    <h3 className="text-lg font-black text-slate-800 mb-4 border-b border-slate-100 pb-3 flex justify-between items-center">
                        Directorio de Cursos
                        <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{courses.length} Activos</span>
                    </h3>
                    
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <span className="text-slate-400 font-bold animate-pulse">Cargando catálogo...</span>
                        </div>
                    ) : (
                        <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                            {courses.map(course => (
                                <div key={course.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-200 transition-colors group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{course.title}</h4>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.description}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ml-3 ${course.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {course.isActive ? 'ACTIVO' : 'INACTIVO'}
                                        </span>
                                    </div>
                                    <div className="flex gap-4 mt-3 pt-3 border-t border-slate-200">
                                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">⏱️ {course.durationMins}m</span>
                                        <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-1">✨ +{course.bonusCompliance} Pts</span>
                                        {course.content?.length > 50 && (
                                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">📄 PDF Extraído</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {courses.length === 0 && (
                                <p className="text-center text-slate-400 font-medium text-sm py-8">No hay cursos creados. ¡Sube un PDF para que Zendi construya el primero!</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
