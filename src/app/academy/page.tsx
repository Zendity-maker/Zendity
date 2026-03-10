"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ZendityAcademyPage() {
    const { user } = useAuth();
    const [courses, setCourses] = useState<any[]>([]);
    const [userCourses, setUserCourses] = useState<any[]>([]);
    const [complianceScore, setComplianceScore] = useState(100);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            setComplianceScore(user.complianceScore ?? 100);
            fetchCoursesData();
        }
    }, [user]);

    const fetchCoursesData = async () => {
        try {
            const hqId = user?.hqId || user?.headquartersId;
            // 1. Cargar el Catálogo de la Sede
            const catRes = await fetch(`/api/academy?hqId=${hqId}`);
            const catData = await catRes.json();

            // 2. Cargar el Progreso del Empleado Activo
            const histRes = await fetch(`/api/academy?hqId=${hqId}&employeeId=${user?.id}`);
            const histData = await histRes.json();

            if (catData.success && histData.success) {
                setCourses(catData.catalog);
                setUserCourses(histData.enrollments);
            }
        } catch (e) {
            console.error("Error fetching courses", e);
        } finally {
            setLoading(false);
        }
    };

    // Helper para determinar el estatus visual del curso
    const getCourseStatus = (courseId: string) => {
        const enrollment = userCourses.find(uc => uc.courseId === courseId);
        return enrollment ? enrollment.status : 'PENDING';
    };

    if (!user) return <div className="p-8 text-center text-teal-600 font-bold animate-pulse">Cargando Plataforma Educativa...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-900 to-teal-700 bg-clip-text text-transparent">
                        Zendity Academy
                    </h2>
                    <p className="text-gray-500 mt-1">
                        LMS para Capacitación Continua Inteligente
                    </p>
                </div>
                <div>
                    <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-bold border border-teal-200">
                            {user?.name?.substring(0, 2).toUpperCase() || 'HQ'}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                            <p className="text-xs text-gray-500">{user?.role}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Resumen de IA */}
                <div className="md:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit">
                    <div className="flex items-center space-x-2 mb-4">
                        <span className="text-2xl">🤖</span>
                        <h3 className="text-lg font-bold text-gray-900">Zendity AI Coach</h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        Hola {user?.name?.split(' ')[0]}. Tu métrica de Certificación Continua es de <span className="font-bold">{complianceScore}/100</span> PTS.
                        {complianceScore < 80 ? ' Hemos detectado áreas obligatorias de refuerzo clínico. Completa los cursos para restaurar tus accesos operacionales.' : ' ¡Excelente trabajo! Mantienes un récord perfecto y tu turno se encuentra activo.'}
                    </p>
                    <button onClick={() => alert("🗂️ Políticas y Procedimientos Operativos en proceso de sincronización con la Sede Central (HQ).")} className="w-full bg-slate-50 text-slate-800 font-semibold py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors text-sm">
                        Ver Políticas de Zendity HQ
                    </button>

                    {complianceScore < 80 && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                            <p className="text-xs font-bold text-red-800 flex gap-2"><span>⚠️</span> Suspensión Activa</p>
                            <p className="text-xs text-red-700 mt-1">Acaba los módulos pendientes para poder marcar tu entrada (Punch-In).</p>
                        </div>
                    )}
                </div>

                {/* Lista de Cursos */}
                <div className="md:col-span-2 space-y-4">
                    {courses.map(course => {
                        const status = getCourseStatus(course.id);
                        return (
                            <div key={course.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1">⏱️ {course.durationMins} MINS</span>
                                            <span className="text-xs text-teal-700 font-bold bg-teal-50 border border-teal-100 px-2 py-0.5 rounded flex items-center gap-1">🚀 +{course.bonusCompliance} PTS</span>
                                            {status === 'COMPLETED' && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">✅ APROBADO</span>}
                                        </div>
                                        <h4 className="text-xl font-bold text-gray-900">{course.title}</h4>
                                        <p className="text-sm text-gray-500 mt-1">{course.description}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[250px] overflow-y-auto mb-4 text-sm text-slate-700 whitespace-pre-wrap font-mono custom-scrollbar">
                                    {course.content || "Material de estudio no disponible."}
                                </div>

                                <div className="flex justify-end border-t border-slate-100 pt-4 mt-auto">
                                    {status !== 'COMPLETED' ? (
                                        <button
                                            disabled={loading}
                                            onClick={async () => {
                                                if (confirm(`¿Has terminado de leer y deseas iniciar la evaluación de "${course.title}"?`)) {
                                                    setLoading(true);
                                                    const hqId = user?.hqId || user?.headquartersId;
                                                    const res = await fetch('/api/academy', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ employeeId: user?.id, hqId, courseId: course.id, examScore: 100 })
                                                    });
                                                    const data = await res.json();

                                                    if (data.success) {
                                                        setComplianceScore(data.newComplianceScore);
                                                        if (data.newComplianceScore >= 80) {
                                                            alert("🎉 ¡Felicidades! Has aprobado el curso. Tu nivel volvió a estado 'Safe' y tus credenciales de turno fueron restauradas.");
                                                        } else {
                                                            alert(`✅ Curso Aprobado. Puntaje actual mejorado a: ${data.newComplianceScore} PTS.`);
                                                        }
                                                    }
                                                    await fetchCoursesData();
                                                }
                                            }}
                                            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all bg-teal-600 hover:bg-teal-700 hover:scale-105 active:scale-95 text-white shadow-md flex items-center gap-2"
                                        >
                                            <span>✍️</span> Tomar Examen de Certificación
                                        </button>
                                    ) : (
                                        <button className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all bg-slate-100 text-slate-500 flex items-center gap-2 cursor-not-allowed">
                                            <span>📜</span> Certificado Guardado en Expediente
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {courses.length === 0 && (
                        <div className="p-12 text-center text-slate-400 font-medium bg-white rounded-2xl border border-dashed border-slate-200">El Directorio de Academia no tiene cursos en desarrollo.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
