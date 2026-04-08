"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import InteractiveCourseCard from "@/components/academy/InteractiveCourseCard";
import { generateZendityMasterCertificate } from "@/components/academy/CertificateGenerator";

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
            const catRes = await fetch(`/api/academy?hqId=${hqId}&role=${user?.role || ''}`);
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

    // Helper to group courses
    const groupedCourses = courses.reduce((acc: any, course: any) => {
        const cat = course.category || "General";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(course);
        return acc;
    }, {});

    const PROTOCOL_SERIES_CODES = [
        "CIERRE_TURNO_101",
        "ADMISION_RESIDENTES_101", 
        "EMAR_101",
        "INCIDENTES_CAIDA_101",
        "HANDOVER_101",
        "ZENDI_AI_101",
        "ACCESO_ROLES_101",
        "MANTENIMIENTO_101"
    ];

    const seriesCourses = courses.filter(c => PROTOCOL_SERIES_CODES.includes(c.moduleCode || c.code || c.id));
    const completedSeriesCourses = seriesCourses.filter(c => getCourseStatus(c.id) === 'COMPLETED');
    const seriesComplete = seriesCourses.length === 8 && completedSeriesCourses.length === 8;

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-10">
            {/* Encabezado y Progreso */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -z-0"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2 text-indigo-300">
                        <img 
                            src="/brand/zendity_logo_white.svg" 
                            alt="Zendity Logo" 
                            className="h-8 w-auto object-contain drop-shadow-sm opacity-90" 
                        />
                        <h2 className="text-sm font-black uppercase tracking-widest">Zendity Academy</h2>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Centro Oficial de Certificación</h1>
                    <p className="text-indigo-200/70 font-medium max-w-md">Catálogo formativo para {user?.name || "Zendity"}</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 min-w-[220px] relative z-10 flex gap-4 items-center">
                    <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-800 font-bold border-2 border-indigo-200 flex-shrink-0 text-xl overflow-hidden">
                         {user?.name?.substring(0, 2).toUpperCase() || 'HQ'}
                    </div>
                    <div>
                        <p className="text-xs uppercase font-bold tracking-widest text-indigo-200 mb-1">
                            {user?.role || "Personal"}
                        </p>
                        <p className={`text-2xl font-black ${complianceScore < 80 ? 'text-red-400' : 'text-emerald-400'}`}>{complianceScore} PTS</p>
                    </div>
                </div>
            </div>

            {/* Aviso de Riesgo Operativo */}
            {complianceScore < 80 && (
                <div className="bg-red-50 border border-red-200 p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden shadow-sm">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-100 rounded-bl-full -z-10 opacity-50"></div>
                    <div>
                        <p className="font-black text-red-800 text-sm tracking-wide uppercase">Riesgo de Operación Clínica</p>
                        <p className="text-sm text-red-900/80 font-medium mt-1">Tu puntaje de certificación está bajo lo requerido. Completa los cursos pendientes para evitar bloqueos de Punch-In en tus siguientes turnos.</p>
                    </div>
                </div>
            )}

            {/* Banner Serie Completa */}
            {seriesComplete && (
                <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-900 rounded-3xl p-8 border border-teal-500/30 shadow-2xl flex items-center justify-between gap-6">
                    <div>
                        <p className="text-teal-400 font-black text-xs uppercase tracking-widest mb-2">🏆 Serie Completa</p>
                        <h3 className="text-white font-black text-2xl mb-1">Personal Adiestrado en Zendity</h3>
                        <p className="text-slate-500 text-sm">Has completado los 8 protocolos oficiales de operación. Descarga tu Certificado Maestro.</p>
                    </div>
                    <button
                        onClick={() => generateZendityMasterCertificate(user?.name || 'Empleado', new Date().toLocaleDateString('es-PR'))}
                        className="shrink-0 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white font-black rounded-2xl transition-all hover:scale-105 shadow-xl shadow-teal-500/30 text-sm"
                    >
                        Descargar Certificado Maestro
                    </button>
                </div>
            )}

            {/* Progreso de la Serie */}
            {!seriesComplete && seriesCourses.length > 0 && (
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700/50 flex items-center gap-6">
                    <div className="flex-1">
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Serie Protocolos Zendity</p>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                            <div 
                                className="bg-teal-500 h-2 rounded-full transition-all duration-700"
                                style={{width: `${(completedSeriesCourses.length / 8) * 100}%`}}
                            />
                        </div>
                    </div>
                    <span className="text-white font-black text-2xl shrink-0">{completedSeriesCourses.length}<span className="text-slate-500 text-base">/8</span></span>
                </div>
            )}

            {/* Cursos por Puesto / Categoría */}
            {Object.keys(groupedCourses).length > 0 ? (
                Object.keys(groupedCourses).map(category => (
                    <div key={category} className="space-y-6">
                        <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-black text-slate-800 capitalize">
                                Certificaciones: {category.toLowerCase()}
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                            {groupedCourses[category].map((course: any) => (
                                <InteractiveCourseCard
                                    key={course.id}
                                    course={course}
                                    user={user}
                                    initialStatus={getCourseStatus(course.id)}
                                    onCourseCompleted={fetchCoursesData}
                                />
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <div className="p-16 text-center text-slate-500 font-medium bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <h3 className="text-xl font-bold text-slate-700">El Directorio está al día</h3>
                    <p className="mt-2 text-slate-500">No hay certificaciones nuevas requeridas para tu rol en este momento.</p>
                </div>
            )}
        </div>
    );
}

