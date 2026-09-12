"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import InteractiveCourseCard from "@/components/academy/InteractiveCourseCard";
import { generateZendityMasterCertificate } from "@/components/academy/CertificateGenerator";
import { Z_SCORE_VISIBLE } from '@/lib/z-score-visible';
import { RUTA_CERTIFICACION } from '@/lib/academy-assign';

// Orden fijo de categorías en la Academy
const CATEGORY_ORDER = [
    // El oficio va PRIMERO. "Cuidado Geriátrico" no estaba en esta lista, así que
    // caía al fallback y se pintaba al final, detrás de dieciséis cursos sobre
    // cómo usar el software.
    //
    // Lo que eso produjo, medido el 10-sep-2026 — matrículas de esos diez cursos
    // en su orden exacto de aparición:
    //
    //     11 · 6 · 3 · 2 · 1 · 1 · 1 · 0 · 0 · 0
    //
    // Eso no es preferencia de tema: es gente que baja hasta donde aguanta. Los
    // tres únicos cursos que se usan son los tres primeros de su categoría.
    "Cuidado Geriátrico",
    "Protocolos Clinicos",
    "Operaciones de Piso",
    "Roles y Acceso",
    "Tecnologia Zendity",
];

/**
 * EL CONTADOR COMPARABA CONTRA IDS QUE NO EXISTEN.
 *
 * Esta lista tenía ids pelados ("CUIDADOR_101"), pero el seed los crea como
 * `${HQ_ID}__CUIDADOR_101` y los diez clínicos son cuid. Así que el filtro no
 * encontraba NUNCA ninguno: la barra clavada en 0%, el encabezado diciendo
 * "0 aprobados" a quien llevaba tres, y el certificado maestro matemáticamente
 * inalcanzable.
 *
 * Ahora se usa la ruta de certificación real, que ya existía en
 * src/lib/academy-assign.ts y se resuelve por fragmento del título — que es
 * como la resuelve también el generador del certificado maestro.
 */
const perteneceALaRuta = (titulo: string) =>
    RUTA_CERTIFICACION.some(r => titulo.toLowerCase().includes(r.toLowerCase()));

export default function ZendityAcademyPage() {
    const { user } = useAuth();
    const [courses, setCourses] = useState<any[]>([]);
    const [userCourses, setUserCourses] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
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
            // El rol ya no viaja por query: el endpoint lo toma de la sesión.
            const catRes = await fetch(`/api/academy?hqId=${hqId}`);
            const catData = await catRes.json();

            const histRes = await fetch(`/api/academy?hqId=${hqId}&employeeId=${user?.id}`);
            const histData = await histRes.json();

            if (catData.success && histData.success) {
                setCourses(catData.catalog);
                setUserCourses(histData.enrollments);
                setAssignments(histData.assignments ?? []);
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

    // Agrupar cursos por categoría, respetando el orden de CATEGORY_ORDER
    const groupedCourses: Record<string, any[]> = {};
    for (const cat of CATEGORY_ORDER) {
        const matching = courses
            .filter(c => (c.category || "General") === cat)
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        if (matching.length > 0) {
            groupedCourses[cat] = matching;
        }
    }
    // Atrapar categorías no listadas en CATEGORY_ORDER (fallback)
    for (const course of courses) {
        const cat = course.category || "General";
        if (!CATEGORY_ORDER.includes(cat)) {
            if (!groupedCourses[cat]) groupedCourses[cat] = [];
            groupedCourses[cat].push(course);
        }
    }

    // Progreso de certificación: los diez cursos del oficio.
    const seriesCourses = courses.filter(c => perteneceALaRuta(c.title ?? ''));
    const completedSeriesCourses = seriesCourses.filter(c => getCourseStatus(c.id) === 'COMPLETED');
    // Recomendacion de Zendi y estado de formacion del ano.
    const [reco, setReco] = useState<any>(null);
    const [formacion, setFormacion] = useState<any>(null);
    useEffect(() => {
        fetch('/api/academy/recomendacion')
            .then(r => r.json())
            .then(d => { if (d.success) { setReco(d.recomendacion); setFormacion(d.formacion); } })
            .catch(() => null);
    }, []);

    const totalSeries = RUTA_CERTIFICACION.length;
    const seriesComplete = seriesCourses.length === totalSeries && completedSeriesCourses.length === totalSeries;

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-10">
            {/* Encabezado — registro institucional, no de app operativa.
                Academy es lo que ACREDITA a un cuidador ante el Departamento de
                la Familia; si la pantalla se siente como un checklist más, nadie
                la trata como formación seria. */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-gradient-to-br from-[#0F2E28] via-[#0F3D33] to-[#0B241F] px-8 py-10 text-white relative">
                    <div className="absolute inset-0 opacity-[0.07]" style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 12px)',
                    }} />
                    <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-7">
                        <div>
                            <div className="flex items-center gap-3 mb-5">
                                <img src="/brand/zendity_logo_white.svg" alt="Zendity" className="h-7 w-auto object-contain opacity-90" />
                                <span className="w-px h-6 bg-white/25" />
                                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300/90">Academia</span>
                            </div>
                            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                                Centro de Formación<br />y Certificación
                            </h1>
                            <p className="text-emerald-100/60 mt-4 text-sm max-w-md leading-relaxed">
                                Expediente formativo de <span className="text-white font-semibold">{user?.name || "—"}</span>
                                {user?.role && <> · {user.role}</>}
                            </p>
                        </div>

                        {/* El expediente: matriculados, aprobados, créditos */}
                        <div className="flex gap-8 shrink-0 border-l border-white/10 pl-8">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/70">Aprobados</p>
                                <p className="font-serif text-4xl mt-1">
                                    {completedSeriesCourses.length}
                                    <span className="text-lg text-white/40">/{totalSeries || courses.length}</span>
                                </p>
                            </div>
                            {/* Esto es lo que ve la EMPLEADA de si misma, y
                                llamarlo "Créditos" ademas confundia el score de
                                cumplimiento con los creditos de Academy, que
                                son otra cosa. Yedaira habria entrado a ver que
                                tiene 0 de 80 — siendo la que mas reporta de su
                                turno. Ver src/lib/z-score-visible.ts */}
                            {Z_SCORE_VISIBLE && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/70">Créditos</p>
                                    <p className={`font-serif text-4xl mt-1 ${complianceScore < 80 ? 'text-amber-300' : 'text-white'}`}>
                                        {complianceScore}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Barra de progreso académico */}
                {totalSeries > 0 && (
                    <div className="px-8 py-5 bg-[#FAFAF9] border-t border-slate-200 flex items-center gap-5">
                        <div className="flex-1">
                            <div className="flex justify-between items-baseline mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Progreso del programa</span>
                                <span className="text-xs font-semibold text-slate-600">
                                    {Math.round((completedSeriesCourses.length / totalSeries) * 100)}% completado
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-[#0F6E56] h-1.5 rounded-full transition-all duration-700"
                                    style={{ width: `${(completedSeriesCourses.length / totalSeries) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* RECOMENDACIÓN DE ZENDI — con su motivo.
                "Tienes 25 cursos sin tomar" no mueve a nadie; "este mes
                registraste 5 situaciones con medicación, este curso dura 35
                minutos" sí. El motivo es lo que convierte una obligación en
                una respuesta a algo que le pasó. */}
            {reco && (
                <div className="mb-6 bg-white border border-[#0F6E56]/20 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-[240px]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0F6E56] mb-2">
                                Zendi te recomienda
                            </p>
                            <h3 className="font-serif text-xl text-slate-900 mb-1.5">{reco.titulo}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                {reco.motivo} <span className="text-slate-400">· {reco.minutos} minutos</span>
                            </p>
                        </div>
                        {formacion && (
                            <div className="text-right shrink-0">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Tu formación
                                </p>
                                <p className="text-2xl font-black text-slate-800 leading-none">
                                    {formacion.aprobados}<span className="text-base text-slate-400">/{formacion.meta}</span>
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    {formacion.meta === 0 ? 'recién empiezas' : 'cursos del año'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* FORMACIÓN ASIGNADA — arriba del catálogo a propósito.
                Es la diferencia entre una biblioteca opcional y un plan de
                estudios: lo que el hogar espera de esta persona, con su motivo. */}
            {assignments.length > 0 && (
                <div className="bg-[#FFFBEB] border border-amber-200 rounded-3xl p-7">
                    <div className="flex items-start gap-3 mb-5">
                        <svg className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.25v11.5m0-11.5a5.75 5.75 0 00-5.75-1.5v11.5A5.75 5.75 0 0112 18m0-11.75a5.75 5.75 0 015.75-1.5v11.5A5.75 5.75 0 0012 18" />
                        </svg>
                        <div>
                            <h2 className="font-serif text-xl text-amber-900 leading-tight">Formación asignada</h2>
                            <p className="text-[13px] text-amber-800/70 mt-1">
                                {assignments.length === 1
                                    ? 'Un curso asignado por tu supervisión.'
                                    : `${assignments.length} cursos asignados por tu supervisión. Empieza por el primero.`}
                            </p>
                        </div>
                    </div>

                    {/* UNO DESTACADO, EL RESTO DEBAJO.
                        Trece tarjetas iguales no son trece tareas: son cero.
                        El servidor ya las manda en orden —lo que sale de un
                        incidente primero, lo vencido delante, y la certificación
                        en el orden de su ruta— y marca la primera. */}
                    <div className="space-y-2">
                        {assignments.map((a: any) => (
                            <div
                                key={a.id}
                                className={`flex items-center gap-4 rounded-2xl px-5 py-4 ${
                                    a.siguiente
                                        ? 'bg-white border-2 border-[#0F6E56]/40 shadow-sm'
                                        : 'bg-white/60 border border-amber-200/70'
                                }`}
                            >
                                {/* La inicial del curso, no un emoji: dentro de
                                    Academy el registro es institucional. */}
                                <span className={`shrink-0 w-9 h-9 rounded-lg font-serif text-lg flex items-center justify-center ${
                                    a.siguiente ? 'bg-[#0F6E56] text-white' : 'bg-amber-100 text-amber-900'
                                }`}>
                                    {(a.title ?? 'Z').trim().charAt(0).toUpperCase()}
                                </span>
                                <div className="flex-1 min-w-0">
                                    {a.siguiente && (
                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0F6E56] mb-0.5">
                                            Empieza por este
                                        </p>
                                    )}
                                    <p className="font-semibold text-slate-800 text-[15px] truncate">{a.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {a.reason} · {a.durationMins} min
                                        {/* El plazo solo se dice cuando existe. La
                                            certificación no lleva fecha a propósito:
                                            una fecha que nadie cumple convierte en
                                            decorado también la que sí importa. */}
                                        {a.textoPlazo && a.textoPlazo !== 'Sin fecha límite' && (
                                            <> · <span className={a.vencida ? 'text-rose-700 font-bold' : 'text-amber-800 font-semibold'}>
                                                {a.textoPlazo}
                                            </span></>
                                        )}
                                    </p>
                                </div>
                                <a
                                    href="#catalogo"
                                    className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                                        a.siguiente
                                            ? 'bg-[#0F6E56] hover:bg-[#0B5642] text-white'
                                            : 'bg-white border border-slate-200 hover:border-[#0F6E56] text-slate-600 hover:text-[#0F6E56]'
                                    }`}
                                >
                                    Ver curso
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Aviso de Riesgo Operativo */}
            {Z_SCORE_VISIBLE && complianceScore < 80 && (
                <div className="bg-white border-l-4 border-amber-500 border-y border-r border-slate-200 rounded-r-2xl px-6 py-5">
                    <p className="font-serif text-lg text-slate-800">Créditos por debajo del mínimo</p>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                        Tienes {complianceScore} de los 80 créditos requeridos. Completar los cursos
                        pendientes restablece tu expediente al nivel exigido.
                    </p>
                </div>
            )}

            {/* Banner Serie Completa */}
            {seriesComplete && (
                <div className="bg-[#FAFAF9] border-2 border-[#0F6E56]/25 rounded-3xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-1 bg-[#0F6E56]" />
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0F6E56] mb-2">Programa completado</p>
                        <h3 className="font-serif text-2xl text-slate-900 mb-1.5">Personal Adiestrado en Zendity</h3>
                        <p className="text-slate-600 text-sm max-w-md leading-relaxed">
                            Has aprobado los {totalSeries} cursos del programa oficial. Tu certificado
                            queda disponible para descarga y para tu expediente.
                        </p>
                    </div>
                    <button
                        onClick={async () => {
                            // El codigo lo emite el servidor tras comprobar que
                            // estan TODOS los cursos aprobados. Antes bastaba
                            // con que el boton apareciera.
                            try {
                                const res = await fetch('/api/academy/certificado-maestro');
                                const d = await res.json();
                                if (!d.success) { alert(d.error || 'No se pudo emitir.'); return; }
                                await generateZendityMasterCertificate({
                                    nombre: d.nombre,
                                    aprobadoEl: d.aprobadoEl,
                                    codigo: d.codigo,
                                    sede: d.sede,
                                });
                            } catch {
                                alert('No se pudo emitir el certificado. Intenta de nuevo.');
                            }
                        }}
                        className="shrink-0 px-7 py-3.5 bg-[#0F6E56] hover:bg-[#0B5642] text-white font-bold rounded-xl transition-colors text-sm"
                    >
                        Descargar certificado
                    </button>
                </div>
            )}

            {/* La barra de progreso vive ahora en el encabezado, junto al
                expediente — tenerla dos veces partía el dato en dos lugares. */}

            {/* Cursos por Categor&iacute;a */}
            {Object.keys(groupedCourses).length > 0 ? (
                <>
                <div id="catalogo" className="pt-2">
                    <h2 className="font-serif text-2xl text-slate-900">Plan de estudios</h2>
                    <p className="text-sm text-slate-500 mt-1">Cursos correspondientes a tu rol.</p>
                </div>
                {Object.keys(groupedCourses).map(category => (
                    <div key={category} className="space-y-5">
                        <div className="flex items-baseline gap-3 border-b border-slate-200 pb-2.5">
                            <h3 className="font-serif text-xl text-slate-800">
                                {category}
                            </h3>
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                {groupedCourses[category].length} {groupedCourses[category].length === 1 ? 'curso' : 'cursos'}
                            </span>
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
                ))}
                </>
            ) : (
                <div className="p-16 text-center bg-[#FAFAF9] rounded-3xl border border-slate-200">
                    <h3 className="font-serif text-xl text-slate-800">Expediente al día</h3>
                    <p className="mt-2 text-slate-500 text-sm">No tienes cursos pendientes para tu rol en este momento.</p>
                </div>
            )}
        </div>
    );
}
