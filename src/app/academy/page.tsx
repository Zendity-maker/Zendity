"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import InteractiveCourseCard from "@/components/academy/InteractiveCourseCard";

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
            const catRes = await fetch(`/api/academy?hqId=${hqId}`);
            const catData = await catRes.json();

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

    const getCourseStatus = (courseId: string) => {
        const enrollment = userCourses.find(uc => uc.courseId === courseId);
        return enrollment ? enrollment.status : 'PENDING';
    };

    if (!user) return <div className="p-8 text-center text-indigo-600 font-bold animate-pulse">Cargando Plataforma Educativa...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-xl shadow-md">Z</span>
                        Zendity Academy
                    </h2>
                    <p className="text-slate-500 mt-1 font-medium">
                        Centro Oficial de Certificación y Capacitación Operativa
                    </p>
                </div>
                <div>
                    <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-800 font-bold border border-indigo-100">
                            {user?.name?.substring(0, 2).toUpperCase() || 'HQ'}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                            <p className="text-xs uppercase font-bold tracking-wider text-indigo-500">{user?.role}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Resumen de IA */}
                <div className="md:col-span-1 bg-gradient-to-b from-white to-slate-50 rounded-2xl p-6 shadow-sm border border-slate-200 h-fit">
                    <div className="flex items-center space-x-3 mb-5">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner shadow-indigo-200/50">🤖</div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight">Zendi AI</h3>
                            <p className="text-xs font-bold text-indigo-600 tracking-wide uppercase">Coach Académico</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                        Hola {user?.name?.split(' ')[0]}. Tu métrica de Certificación Oficial Zendity es de <span className={`font-black ${complianceScore < 80 ? 'text-red-600' : 'text-emerald-600'}`}>{complianceScore}/100</span> PTS.
                        {complianceScore < 80 ? ' Tienes certificaciones críticas pendientes. Completa los módulos para evitar bloqueos operativos.' : ' ¡Excelente ritmo! Mantienes tus certificaciones al día.'}
                    </p>
                    <button onClick={() => alert("🗂️ Políticas y Procedimientos Operativos en proceso de sincronización con la central.")} className="w-full bg-white text-slate-700 font-bold py-3 rounded-xl border-2 border-slate-200 hover:border-indigo-300 hover:text-indigo-700 transition-all text-sm mb-4">
                        Leer Políticas Corporativas Mínimas
                    </button>

                    {complianceScore < 80 && (
                        <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-red-100 rounded-bl-full -z-10 opacity-50"></div>
                            <p className="text-xs font-black text-red-800 flex items-center gap-2 tracking-wide uppercase mb-1">
                                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                                Riesgo de Operación
                            </p>
                            <p className="text-xs text-red-900/80 font-medium">Si tu puntaje baja de 80, no podrás hacer Punch-In en tus turnos clínicos.</p>
                        </div>
                    )}
                </div>

                {/* Lista de Cursos Interactivos */}
                <div className="md:col-span-2 space-y-5">
                    {courses.map(course => (
                        <InteractiveCourseCard
                            key={course.id}
                            course={course}
                            user={user}
                            initialStatus={getCourseStatus(course.id)}
                            onCourseCompleted={fetchCoursesData}
                        />
                    ))}
                    {courses.length === 0 && (
                        <div className="p-12 text-center text-slate-400 font-medium bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                            <span className="text-4xl mb-3">🎓</span>
                            <p>El Directorio de Certificaciones Oficiales está al día.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

