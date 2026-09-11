'use client';
import { useState, useEffect, useRef } from 'react';
import { generateZendityCertificate } from './CertificateGenerator';
import {
    usarPreferencias, ControlesDeLectura, Lectura, Hoja, Columna,
    BotonPrincipal, BotonDiscreto, HiloDeSecciones, SERIF, anchoColumna,
} from './lectura';

// ── Types ──────────────────────────────────────────────────────────────────────

type Stage = 'IDLE' | 'INTRO' | 'READING' | 'SECTION_QUIZ' | 'SECTION_RESULT' | 'REFLECTION' | 'RESULT' | 'COMPLETED';

interface SectionQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

interface ParsedSection {
    number: number;
    title: string;
    lectura: string;
    preguntas: SectionQuestion[];
}

interface CourseMeta {
    titulo: string;
    promptZendi: string;
    terminosClave: string;
    preguntaReflexion: string;
}

interface Props {
    course: any;
    user: any;
    initialStatus?: string;
    onCourseCompleted?: () => void;
}

// ── Standalone Parsers ─────────────────────────────────────────────────────────

function parseQuestions(raw: string): SectionQuestion[] {
    const questions: SectionQuestion[] = [];
    const qBlocks = raw.split(/(?=P:\s)/);

    for (const block of qBlocks) {
        if (!block.trim().startsWith('P:')) continue;
        const lines = block.trim().split('\n');
        const question = lines[0].replace(/^P:\s*/, '').trim();
        const options: string[] = [];
        let correctIndex = -1;
        let explanation = '';

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            if (line.startsWith('EXPLICACION:')) {
                explanation = line.replace('EXPLICACION:', '').trim();
                continue;
            }
            const optMatch = line.match(/^(\*?)([a-d])\)\s*(.*)/);
            if (optMatch) {
                if (optMatch[1] === '*') correctIndex = options.length;
                options.push(optMatch[3]);
            }
        }

        if (question && options.length >= 2 && correctIndex >= 0) {
            questions.push({ question, options, correctIndex, explanation });
        }
    }
    return questions;
}

function parseCourseContent(content: string): { meta: CourseMeta; sections: ParsedSection[] } {
    const meta: CourseMeta = { titulo: '', promptZendi: '', terminosClave: '', preguntaReflexion: '' };
    if (!content) return { meta, sections: [] };

    // Extract META block
    const metaMatch = content.match(/---META---([\s\S]*?)(?=---SECCION_)/);
    if (metaMatch) {
        const m = metaMatch[1];
        meta.titulo = m.match(/TITULO:\s*(.*)/)?.[1]?.trim() || '';
        meta.promptZendi = m.match(/PROMPT_ZENDI:\s*(.*)/)?.[1]?.trim() || '';
        meta.terminosClave = m.match(/TERMINOS_CLAVE:\s*(.*)/)?.[1]?.trim() || '';
        const refMatch = m.match(/PREGUNTA_REFLEXION:\s*([\s\S]*?)(?=\n(?:TITULO|PROMPT_ZENDI|TERMINOS_CLAVE):|$)/);
        meta.preguntaReflexion = refMatch?.[1]?.trim() || '';
    }

    // Extract each SECCION block
    const sections: ParsedSection[] = [];
    const sectionRegex = /---SECCION_(\d+)---([\s\S]*?)(?=---SECCION_\d+---|$)/g;
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
        const num = parseInt(match[1]);
        const body = match[2];
        const lecturaMatch = body.match(/LECTURA:\s*([\s\S]*?)(?=PREGUNTAS:)/);
        const preguntasMatch = body.match(/PREGUNTAS:\s*([\s\S]*?)$/);
        const lectura = lecturaMatch?.[1]?.trim() || '';
        const preguntasRaw = preguntasMatch?.[1]?.trim() || '';
        const preguntas = parseQuestions(preguntasRaw);
        const titleMatch = lectura.match(/^#+\s*(.*)/m);
        const title = titleMatch?.[1]?.trim() || `Seccion ${num}`;
        sections.push({ number: num, title, lectura, preguntas });
    }

    return { meta, sections };
}

/** "1 secciones" no lo escribe nadie. */
function cuentaSecciones(n: number): string {
    return n === 1 ? 'una sección' : `${n} secciones`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function InteractiveCourseCard({ course, user, initialStatus, onCourseCompleted }: Props) {
    const [stage, setStage] = useState<Stage>(initialStatus === 'COMPLETED' ? 'COMPLETED' : 'IDLE');
    const [error, setError] = useState('');

    // Resultado de la certificación: delta REAL aplicado al Z-Score + flags.
    // Si alreadyCompleted=true, evita mostrar fanfarria como si fuera nuevo.
    const [completionResult, setCompletionResult] = useState<{
        delta: number;
        unblocked: boolean;
        alreadyCompleted: boolean;
    } | null>(null);
    const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

    // Course structure
    const [courseMeta, setCourseMeta] = useState<CourseMeta | null>(null);
    const [sections, setSections] = useState<ParsedSection[]>([]);
    const [currentSection, setCurrentSection] = useState(0);

    // Section quiz
    const [currentQ, setCurrentQ] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [sectionCorrect, setSectionCorrect] = useState(0);
    const [sectionScores, setSectionScores] = useState<number[]>([]);

    // Reflection
    const [reflection, setReflection] = useState('');
    const [reflectionResult, setReflectionResult] = useState<{ approved: boolean; feedback: string } | null>(null);
    const [reflectionLoading, setReflectionLoading] = useState(false);

    // Locks & strikes
    const [strikes, setStrikes] = useState(0);
    const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
    // Id de la matricula: es lo que el servidor necesita para emitir el codigo
    // del certificado contra el registro real de aprobacion.
    const [ucId, setUcId] = useState<string | null>(null);
    const [emitiendo, setEmitiendo] = useState(false);
    const [lockCountdown, setLockCountdown] = useState('');

    const hqId = (user as any)?.hqId || (user as any)?.headquartersId || '';

    // Tamaño de letra y luz baja — se recuerdan entre cursos y entre turnos.
    // Va aquí arriba porque es un hook: no puede quedar detrás de un return.
    const { tamano, setTamano, luzBaja, setLuzBaja, c } = usarPreferencias();

    /**
     * La explicación de una respuesta nace DEBAJO del pliegue.
     *
     * Con cuatro opciones en una tableta, el bloque que dice por qué la
     * respuesta era la otra queda fuera de pantalla, y el botón "Siguiente
     * pregunta" sí se ve. O sea: la parte que enseña se la salta todo el mundo
     * sin querer. Al aparecer, sube sola.
     */
    const explicacionRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!showExplanation) return;
        const t = setTimeout(() => explicacionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
        return () => clearTimeout(t);
    }, [showExplanation]);

    // ── Effects ────────────────────────────────────────────────────────────────

    /**
     * Pide al servidor los datos del certificado y lo dibuja.
     *
     * Antes el PDF se armaba en el navegador con tres textos y `new Date()`,
     * asi que la fecha era la del dia de impresion y no quedaba registro de
     * nada. Ahora el codigo lo emite el servidor contra el registro de
     * aprobacion y es el mismo en todas las copias.
     */
    const imprimirCertificado = async (idExplicito?: string) => {
        // idExplicito: al aprobar, la matrícula llega en la respuesta del POST y
        // el estado todavía no se ha propagado. Sin esto, la emisión automática
        // se dispararía con `ucId` en null y no haría nada — el mismo fallo que
        // tenía muerto el botón.
        const id = idExplicito ?? ucId;
        if (!id || emitiendo) return;
        setEmitiendo(true);
        try {
            const res = await fetch(`/api/academy/certificado/${id}`);
            const d = await res.json();
            if (!d.success) {
                alert(d.error || 'No se pudo emitir el certificado.');
                return;
            }
            await generateZendityCertificate({
                nombre: d.nombre,
                curso: d.curso,
                aprobadoEl: d.aprobadoEl,
                codigo: d.codigo,
                sede: d.sede,
                venceEl: d.venceEl,
            });
        } catch {
            alert('No se pudo emitir el certificado. Intenta de nuevo.');
        } finally {
            setEmitiendo(false);
        }
    };

    useEffect(() => {
        if (!user?.id || !course?.id) return;
        fetch(`/api/academy?employeeId=${user.id}&hqId=${hqId}`)
            .then(r => r.json())
            .then(data => {
                const enrollment = data?.enrollments?.find((e: any) => e.courseId === course.id);
                if (enrollment?.lockedUntil && new Date(enrollment.lockedUntil) > new Date()) {
                    setLockedUntil(new Date(enrollment.lockedUntil));
                }
                if (enrollment?.attemptsCount) setStrikes(enrollment.attemptsCount % 3);
                if (enrollment?.id) setUcId(enrollment.id);
            }).catch(() => null);
    }, [user?.id, course?.id, hqId]);

    useEffect(() => {
        if (!lockedUntil) return;
        const interval = setInterval(() => {
            const remaining = lockedUntil.getTime() - Date.now();
            if (remaining <= 0) { setLockedUntil(null); clearInterval(interval); return; }
            const h = Math.floor(remaining / 3600000);
            const m = Math.floor((remaining % 3600000) / 60000);
            setLockCountdown(`${h}h ${m}m`);
        }, 1000);
        return () => clearInterval(interval);
    }, [lockedUntil]);

    // ── Actions ────────────────────────────────────────────────────────────────

    /**
     * El texto del curso llega AL PULSAR, no con el catálogo.
     *
     * El catálogo mandaba los cursos enteros: 431 KB al abrir Academy en la
     * tableta, de los cuales 420 eran markdown de cursos que nadie iba a abrir.
     * Ahora vienen 11 KB de tarjetas, y los 24 KB del curso se piden aquí.
     *
     * `contenidoCache` evita repetir la petición cuando alguien abre, cierra y
     * vuelve a abrir el mismo curso en la misma sesión.
     */
    const [cargandoContenido, setCargandoContenido] = useState(false);
    const contenidoCache = useRef<string | null>(null);

    const obtenerContenido = async (): Promise<string | null> => {
        if (course.content) return course.content;
        if (contenidoCache.current) return contenidoCache.current;
        setCargandoContenido(true);
        try {
            const res = await fetch(`/api/academy/curso/${course.id}`);
            const d = await res.json();
            if (!d.success || !d.curso?.content) return null;
            contenidoCache.current = d.curso.content;
            return d.curso.content;
        } catch {
            return null;
        } finally {
            setCargandoContenido(false);
        }
    };

    const startLesson = async () => {
        setError('');
        const contenido = await obtenerContenido();
        if (!contenido) { setError('No se pudo abrir el curso. Intenta de nuevo.'); return; }

        const { meta, sections: parsed } = parseCourseContent(contenido);
        if (parsed.length === 0) { setError('El formato del curso no es compatible.'); return; }

        setCourseMeta(meta);
        setSections(parsed);
        setCurrentSection(0);
        setSectionScores([]);
        setReflection('');
        setReflectionResult(null);
        setStage('INTRO');
    };

    const resetSectionQuiz = () => {
        setCurrentQ(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setSectionCorrect(0);
    };

    const goToReading = () => {
        resetSectionQuiz();
        setStage('READING');
    };

    const goToSectionQuiz = () => {
        const section = sections[currentSection];
        if (!section || section.preguntas.length === 0) {
            setSectionScores(prev => [...prev, 100]);
            advanceAfterSection();
            return;
        }
        resetSectionQuiz();
        setStage('SECTION_QUIZ');
    };

    const advanceAfterSection = () => {
        if (currentSection < sections.length - 1) {
            setCurrentSection(prev => prev + 1);
            goToReading();
        } else {
            setStage('REFLECTION');
        }
    };

    const handleAnswer = (idx: number) => {
        if (showExplanation) return;
        setSelectedAnswer(idx);
        setShowExplanation(true);
        const isCorrect = idx === sections[currentSection].preguntas[currentQ].correctIndex;
        if (isCorrect) setSectionCorrect(prev => prev + 1);
    };

    const handleNextQuestion = () => {
        const section = sections[currentSection];
        if (currentQ < section.preguntas.length - 1) {
            setCurrentQ(prev => prev + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
        } else {
            // All questions answered — show section result
            setStage('SECTION_RESULT');
        }
    };

    const handleReflection = async () => {
        if (reflection.trim().length < 20) {
            setReflectionResult({ approved: false, feedback: 'Por favor escribe una respuesta mas completa. Minimo 2-3 oraciones.' });
            return;
        }
        setReflectionLoading(true);
        try {
            const res = await fetch('/api/academy/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestType: 'reflection',
                    courseId: course.id,
                    userResponse: reflection,
                    promptZendi: courseMeta?.promptZendi || '',
                    terminosClave: courseMeta?.terminosClave || '',
                    preguntaReflexion: courseMeta?.preguntaReflexion || '',
                })
            });
            const data = await res.json();
            const result = data?.data || data;
            setReflectionResult({ approved: result.approved, feedback: result.feedback });
            if (result.approved) {
                await completeCourse();
            }
        } catch {
            setReflectionResult({ approved: false, feedback: 'Error evaluando la respuesta. Intenta de nuevo.' });
        } finally {
            setReflectionLoading(false);
        }
    };

    const totalScore = sectionScores.length > 0
        ? Math.round(sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length)
        : 0;

    const completeCourse = async () => {
        // Guard contra doble-click: si ya estamos enviando, salir.
        if (isSubmittingCompletion) return;
        setIsSubmittingCompletion(true);
        try {
            const res = await fetch('/api/academy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: user.id,
                    courseId: course.id,
                    hqId,
                    examScore: totalScore,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (data?.success) {
                /**
                 * AQUI ESTABAN LOS 0 CERTIFICADOS.
                 *
                 * `ucId` solo se llenaba en el useEffect de montaje, que busca
                 * una matrícula que para un curso recién abierto todavía no
                 * existe. Y los dos botones del certificado son
                 * `disabled={!ucId}`. O sea: en el instante exacto del logro,
                 * el botón estaba muerto.
                 *
                 * Once personas aprobaron Cuidado Geriátrico General y ninguna
                 * pudo descargar su certificado en el momento. El POST YA
                 * devuelve la matrícula creada; solo había que recogerla.
                 */
                if (data.enrollment?.id) setUcId(data.enrollment.id);

                /**
                 * Y SE EMITE SOLO. Decisión de Andrés, 10-sep-2026:
                 * "automático al aprobar".
                 *
                 * Pedirle a alguien que acaba de aprobar que además pulse un
                 * botón para recibir su certificado es poner una puerta justo
                 * en el momento del logro. Once personas aprobaron y ninguna lo
                 * tiene.
                 *
                 * El botón sigue existiendo en la pantalla COMPLETED para
                 * volver a descargarlo. Lo que cambia es que ya no hace falta
                 * acordarse.
                 */
                if (data.enrollment?.id && !data.alreadyCompleted) {
                    setTimeout(() => imprimirCertificado(data.enrollment.id), 900);
                }

                setCompletionResult({
                    delta: data.delta ?? 0,
                    unblocked: !!data.unblocked,
                    alreadyCompleted: !!data.alreadyCompleted,
                });
                if (data.alreadyCompleted) {
                    // Ya estaba completado — sin fanfarria, ir directo a estado COMPLETED.
                    setStage('COMPLETED');
                } else {
                    setStage('RESULT');
                }
            } else {
                // Falla del backend: igual mostramos RESULT (mejor que dejar al usuario colgado)
                // pero sin info de delta.
                setCompletionResult({ delta: 0, unblocked: false, alreadyCompleted: false });
                setStage('RESULT');
            }
            if (onCourseCompleted) onCourseCompleted();
        } catch {
            setCompletionResult({ delta: 0, unblocked: false, alreadyCompleted: false });
            setStage('RESULT');
        } finally {
            setIsSubmittingCompletion(false);
        }
    };

    const handleFail = async () => {
        try {
            const res = await fetch('/api/academy/attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId: user.id, courseId: course.id, hqId })
            });
            const data = await res.json();
            if (data.locked) setLockedUntil(new Date(data.lockedUntil));
            setStrikes(prev => Math.min(prev + 1, 3));
        } catch { /* silent */ }
        setStage('IDLE');
    };

    const sectionQuizProgress = sections[currentSection]?.preguntas.length > 0
        ? Math.round((currentQ / sections[currentSection].preguntas.length) * 100)
        : 0;

    // ── RENDER: BLOQUEADO ──────────────────────────────────────────────────────

    if (lockedUntil) return (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center">
            <h3 className="font-serif text-lg text-slate-900 mb-1">{course.title}</h3>
            <p className="text-rose-700 font-bold text-sm mb-1">Acceso bloqueado temporalmente</p>
            <p className="text-slate-500 text-xs">Se desbloquea en <span className="font-bold text-rose-600">{lockCountdown}</span></p>
            <p className="text-slate-500 text-xs mt-2">3 intentos fallidos — periodo de reflexión de 24 horas</p>
        </div>
    );

    // ── RENDER: COMPLETADO ─────────────────────────────────────────────────────

    if (stage === 'COMPLETED' || initialStatus === 'COMPLETED') return (
        <div className="bg-white rounded-2xl border border-teal-200 p-6">
            <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700 mb-1.5">Aprobado</p>
                <h3 className="font-serif text-lg text-slate-900 leading-snug">{course.title}</h3>
            </div>
            <button
                onClick={() => imprimirCertificado()}
                disabled={!ucId || emitiendo}
                className="w-full bg-[#0F6E56] hover:bg-[#0B5642] disabled:opacity-40 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
                {emitiendo ? 'Emitiendo…' : 'Imprimir certificado'}
            </button>
        </div>
    );

    // ── RENDER: CURSO APROBADO ─────────────────────────────────────────────────

    if (stage === 'RESULT') return (
        <Hoja c={c} tamano={tamano} centrado
            pie={<>
                <BotonPrincipal c={c} onClick={() => imprimirCertificado()} disabled={!ucId || emitiendo}>
                    {emitiendo ? 'Emitiendo el certificado…' : 'Descargar mi certificado'}
                </BotonPrincipal>
                <div className="text-center mt-1">
                    <BotonDiscreto c={c} onClick={() => setStage('COMPLETED')}>Cerrar</BotonDiscreto>
                </div>
            </>}
        >
            <Columna tamano={tamano} className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] mb-6" style={{ color: c.realce }}>
                    Curso aprobado
                </p>
                <h1 className="font-bold leading-tight mb-5" style={{ fontFamily: SERIF, fontSize: 34, color: c.tinta }}>
                    {course.title}
                </h1>
                <div className="h-px w-24 mx-auto mb-6" style={{ backgroundColor: c.filete }} />

                <p style={{ fontFamily: SERIF, fontSize: 19, color: c.suave }}>
                    Promedio de las {sections.length} secciones:{' '}
                    <span className="font-bold" style={{ color: c.tinta }}>{totalScore}%</span>
                </p>

                {sectionScores.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center mt-5">
                        {sectionScores.map((s, i) => (
                            <span key={i} className="text-[12px] font-bold px-2.5 py-1 rounded-lg"
                                style={{ backgroundColor: c.realceSuave, color: c.realce }}>
                                Sección {i + 1}: {s}%
                            </span>
                        ))}
                    </div>
                )}

                {/* El Z-Score salía aquí — era la NOVENA fuga del mismo número.
                    El 09-sep-2026 se ocultó de nueve pantallas y el 10 se limpió la
                    API y la notificación, pero esta se quedó atrás: como la ruta ya
                    devuelve `delta: null`, el `?? 0` mandaba a TODO el mundo a la
                    rama del else, y cada persona que terminaba un curso leía
                    "Ya estás en el máximo Z-Score (100)" — de un número oculto, y
                    falso para casi todas. Ver src/lib/z-score-visible.ts.

                    El curso aprobado ya es la noticia. No hace falta un número
                    detrás, y menos uno que no es verdad. */}

                {/* Si RRHH la tenía bloqueada para turnos y este curso la desbloqueó */}
                {completionResult?.unblocked && (
                    <p className="mt-7 mx-auto max-w-sm px-5 py-3 rounded-xl text-[14px] font-bold"
                        style={{ backgroundColor: c.realceSuave, color: c.realce }}>
                        Tu acceso a turnos fue restablecido.
                    </p>
                )}

                <p className="mt-8 text-[13px]" style={{ color: c.suave }}>
                    Tu certificado se está descargando. Queda guardado en tu expediente
                    y puedes volver a imprimirlo cuando quieras.
                </p>
            </Columna>
        </Hoja>
    );

    // ── RENDER: EN LA ESTANTERÍA ───────────────────────────────────────────────

    if (stage === 'IDLE') return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all flex flex-col">
            {/* Portada 16:9. Las imágenes actuales son 768×768 cuadradas y se
                recortan al centro; el formato apaisado da el aire editorial que
                pide una academia y sobrevive a un reemplazo de arte futuro. */}
            <div className="relative w-full aspect-[16/9] bg-[#0F2E28] overflow-hidden">
                {course.imageUrl ? (
                    <img
                        src={course.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : (
                    /* Sin arte: la inicial del curso en serif. Antes caía aquí un
                       emoji de libro — dentro de Academy no hay emoji. */
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white/25 font-bold" style={{ fontFamily: SERIF, fontSize: 64 }}>
                            {(course.title ?? 'Z').trim().charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
                {/* Velo inferior: asienta la portada y deja legible el sello */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F2E28]/70 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/90">
                    {course.category}
                </span>
                {strikes > 0 && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full bg-white/95 text-rose-700">
                        Intento {strikes}/3
                    </span>
                )}
            </div>

            <div className="p-5 flex flex-col flex-1">
                <h3 className="font-serif text-lg text-slate-900 leading-snug">{course.title}</h3>
                <p className="text-slate-500 text-[13px] mt-2 leading-relaxed line-clamp-2 flex-1">{course.description}</p>

                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
                    <span>{course.durationMins || 15} min</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>{course.bonusCompliance || 10} créditos</span>
                </div>

                {error && <p className="text-rose-600 text-xs mt-2">{error}</p>}
                <button onClick={startLesson} disabled={cargandoContenido}
                    className="mt-4 w-full bg-[#0F6E56] hover:bg-[#0B5642] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                    {cargandoContenido ? 'Abriendo…' : 'Comenzar'}
                </button>
            </div>
        </div>
    );

    // ── RENDER: PORTADA ────────────────────────────────────────────────────────

    /**
     * Antes esto era "Hola! Soy Zendi" con una maestra emoji y cuatro chips
     * (secciones, preguntas, reflexión, certificado) que decían el CONTINENTE
     * sin decir el CONTENIDO. Quien abría el curso no sabía de qué iba hasta
     * la segunda pantalla.
     *
     * Ahora es la portada de un cuadernillo: el título, y debajo el índice REAL
     * de las secciones que va a leer, con sus nombres. El índice no es adorno —
     * saber de antemano por dónde se pasa es lo que sostiene la lectura larga.
     */
    if (stage === 'INTRO') return (
        <Hoja c={c} tamano={tamano}
            cabecera={<>
                <BotonDiscreto c={c} onClick={() => setStage('IDLE')}>Cerrar</BotonDiscreto>
                {/* En un teléfono no cabe con los controles al lado: se parte
                    en dos líneas y descuadra la cabecera. Quien abre el curso
                    ya sabe dónde está. */}
                <span className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap"
                    style={{ color: c.suave }}>
                    Zéndity Academy
                </span>
                <ControlesDeLectura c={c} tamano={tamano} setTamano={setTamano} luzBaja={luzBaja} setLuzBaja={setLuzBaja} />
            </>}
            pie={<BotonPrincipal c={c} onClick={goToReading}>Comenzar la lectura</BotonPrincipal>}
        >
            <Columna tamano={tamano}>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: c.realce }}>
                    {course.category}
                </p>
                <h1 className="font-bold leading-tight" style={{ fontFamily: SERIF, fontSize: 36, color: c.tinta }}>
                    {course.title}
                </h1>

                {course.description && (
                    <p className="mt-5" style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.6, color: c.suave }}>
                        {course.description}
                    </p>
                )}

                <div className="h-px my-9" style={{ backgroundColor: c.filete }} />

                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] mb-5" style={{ color: c.suave }}>
                    Índice
                </h2>
                <ol className="space-y-4">
                    {sections.map((s, i) => (
                        <li key={i} className="flex gap-4 items-baseline">
                            <span className="font-bold flex-shrink-0 tabular-nums"
                                style={{ fontFamily: SERIF, fontSize: 15, color: c.realce, width: '1.6em' }}>
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="flex-1" style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.45, color: c.tinta }}>
                                {s.title}
                                {s.preguntas.length > 0 && (
                                    /* En el teléfono baja a su propia línea: colgado
                                       del título, el punto se quedaba solo al final
                                       del renglón. */
                                    <span className="block sm:inline sm:ml-2 text-[13px]" style={{ color: c.suave }}>
                                        <span className="hidden sm:inline">· </span>
                                        {s.preguntas.length} preguntas
                                    </span>
                                )}
                            </span>
                        </li>
                    ))}
                </ol>

                <div className="h-px my-9" style={{ backgroundColor: c.filete }} />

                <p style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.7, color: c.suave }}>
                    Cada sección termina con sus preguntas, y hay que acertar el 80% para
                    pasar a la siguiente. Si una no sale, se vuelve a leer y se repite —
                    no se pierde lo aprobado. Al final hay una pregunta abierta sobre tu
                    propio trabajo; cuando la apruebes, el certificado se emite y se
                    descarga solo.
                </p>
            </Columna>
        </Hoja>
    );

    // ── RENDER: LECTURA ────────────────────────────────────────────────────────

    if (stage === 'READING' && sections.length > 0) {
        const section = sections[currentSection];
        return (
            <Hoja key={`lectura-${currentSection}`} c={c} tamano={tamano}
                cabecera={<>
                    <BotonDiscreto c={c} onClick={() => setStage('IDLE')}>Cerrar</BotonDiscreto>
                    <HiloDeSecciones c={c} total={sections.length} actual={currentSection} />
                    <ControlesDeLectura c={c} tamano={tamano} setTamano={setTamano} luzBaja={luzBaja} setLuzBaja={setLuzBaja} />
                </>}
                pie={
                    <BotonPrincipal c={c} onClick={goToSectionQuiz}>
                        {section.preguntas.length > 0
                            ? `Ir a las preguntas (${section.preguntas.length})`
                            : 'Continuar'}
                    </BotonPrincipal>
                }
            >
                {/* Portadilla de sección. El título sale UNA vez: el `# Título`
                    con el que empieza la lectura se oculta en <Lectura>. */}
                <Columna tamano={tamano}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: c.realce }}>
                        Sección {currentSection + 1} de {sections.length}
                    </p>
                    <h1 className="font-bold leading-tight mb-8" style={{ fontFamily: SERIF, fontSize: 30, color: c.tinta }}>
                        {section.title}
                    </h1>
                </Columna>

                <Lectura markdown={section.lectura} tamano={tamano} c={c} />

                {/* La nota al margen. Antes era "Zendi dice" con una bombilla; el
                    contenido es el mismo, pero aquí no interrumpe la lectura —
                    va al final, en cursiva, como una acotación del cuadernillo. */}
                <Columna tamano={tamano}>
                    <div className="mt-12 pt-5" style={{ borderTop: `1px solid ${c.filete}` }}>
                        <p className="italic" style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.65, color: c.suave }}>
                            {currentSection === 0
                                ? `Lee con calma. Al terminar respondes ${section.preguntas.length} preguntas sobre esta sección.`
                                : currentSection === sections.length - 1
                                    ? 'Última sección. Después de las preguntas viene tu reflexión final.'
                                    : `${cuentaSecciones(sections.length - currentSection - 1)} por delante. Necesitas 80% para avanzar.`}
                        </p>
                    </div>
                </Columna>
            </Hoja>
        );
    }

    // ── RENDER: PREGUNTAS DE LA SECCIÓN ────────────────────────────────────────

    if (stage === 'SECTION_QUIZ' && sections[currentSection]?.preguntas.length > 0) {
        const section = sections[currentSection];
        const q = section.preguntas[currentQ];
        const isLastQ = currentQ === section.preguntas.length - 1;
        const acerto = selectedAnswer === q.correctIndex;

        return (
            <Hoja key={`pregunta-${currentSection}-${currentQ}`} c={c} tamano={tamano}
                cabecera={<>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] truncate" style={{ color: c.realce }}>
                            Sección {currentSection + 1} · preguntas
                        </p>
                        <p className="text-[13px] font-bold truncate" style={{ fontFamily: SERIF, color: c.tinta }}>
                            {section.title}
                        </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-[11px] tabular-nums" style={{ color: c.suave }}>
                            {currentQ + 1} de {section.preguntas.length}
                        </p>
                        <p className="text-[11px] font-bold tabular-nums" style={{ color: c.realce }}>
                            {sectionCorrect} correctas
                        </p>
                    </div>
                </>}
                pie={showExplanation
                    ? <BotonPrincipal c={c} onClick={handleNextQuestion}>
                        {isLastQ ? 'Ver el resultado de la sección' : 'Siguiente pregunta'}
                    </BotonPrincipal>
                    : undefined}
            >
                {/* Avance dentro de la sección: un filete que crece, no una barra */}
                <div className="mx-auto mb-9" style={{ maxWidth: anchoColumna(tamano) }}>
                    <div className="h-[3px] rounded-full" style={{ backgroundColor: c.filete }}>
                        <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${sectionQuizProgress}%`, backgroundColor: c.realce }} />
                    </div>
                </div>

                <Columna tamano={tamano}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: c.suave }}>
                        Pregunta {currentQ + 1}
                    </p>
                    <p className="font-bold leading-snug mb-8" style={{ fontFamily: SERIF, fontSize: 24, color: c.tinta }}>
                        {q.question}
                    </p>

                    <div className="space-y-3">
                        {q.options.map((opt, i) => {
                            let borde = c.filete, fondo = c.hoja, texto = c.tinta, letra = c.suave;
                            if (showExplanation) {
                                if (i === q.correctIndex) { borde = c.realce; fondo = c.realceSuave; letra = c.realce; }
                                else if (i === selectedAnswer) { borde = c.fallo; fondo = c.falloSuave; letra = c.fallo; }
                                else { texto = c.suave; }
                            } else if (selectedAnswer === i) {
                                borde = c.realce; fondo = c.realceSuave; letra = c.realce;
                            }
                            return (
                                <button key={i} onClick={() => handleAnswer(i)} disabled={showExplanation}
                                    className="w-full text-left p-4 rounded-xl transition-colors flex gap-3 items-baseline"
                                    style={{ border: `1px solid ${borde}`, backgroundColor: fondo, fontFamily: SERIF, fontSize: 18, lineHeight: 1.5, color: texto }}>
                                    <span className="font-bold flex-shrink-0" style={{ color: letra }}>
                                        {['A', 'B', 'C', 'D'][i]}.
                                    </span>
                                    <span className="flex-1">{opt}</span>
                                </button>
                            );
                        })}
                    </div>

                    {showExplanation && (
                        <div ref={explicacionRef} className="mt-8 pt-5"
                            style={{ borderTop: `2px solid ${acerto ? c.realce : c.fallo}` }}>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3"
                                style={{ color: acerto ? c.realce : c.fallo }}>
                                {acerto ? 'Correcto' : 'No es esa'}
                            </p>
                            {q.explanation && (
                                <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.68, color: c.tinta }}>
                                    {q.explanation}
                                </p>
                            )}
                        </div>
                    )}
                </Columna>
            </Hoja>
        );
    }

    // ── RENDER: RESULTADO DE LA SECCIÓN ────────────────────────────────────────

    if (stage === 'SECTION_RESULT') {
        const section = sections[currentSection];
        const total = section?.preguntas.length || 0;
        const pct = total > 0 ? Math.round((sectionCorrect / total) * 100) : 100;
        const needed = Math.ceil(total * 0.8);
        const passed = sectionCorrect >= needed;
        const isLast = currentSection >= sections.length - 1;

        const handleContinue = () => {
            const scorePct = total > 0 ? Math.round((sectionCorrect / total) * 100) : 100;
            setSectionScores(prev => [...prev, scorePct]);
            advanceAfterSection();
        };

        return (
            <Hoja c={c} tamano={tamano} centrado
                pie={passed
                    ? <BotonPrincipal c={c} onClick={handleContinue}>
                        {isLast ? 'Ir a la reflexión final' : 'Siguiente sección'}
                    </BotonPrincipal>
                    : <>
                        <BotonPrincipal c={c} onClick={goToReading}>Releer la sección y reintentar</BotonPrincipal>
                        <div className="text-center mt-1">
                            <BotonDiscreto c={c} onClick={handleFail}>
                                Dejarlo por hoy (intento {strikes + 1} de 3)
                            </BotonDiscreto>
                        </div>
                    </>}
            >
                <Columna tamano={tamano} className="text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] mb-5"
                        style={{ color: passed ? c.realce : c.fallo }}>
                        {passed ? `Sección ${currentSection + 1} aprobada` : `Sección ${currentSection + 1} no aprobada`}
                    </p>
                    <p className="font-bold mb-4" style={{ fontFamily: SERIF, fontSize: 34, color: c.tinta }}>
                        {sectionCorrect} de {total} <span style={{ color: c.suave }}>({pct}%)</span>
                    </p>
                    <p style={{ fontFamily: SERIF, fontSize: 17, color: c.suave }}>
                        {passed
                            ? (isLast
                                ? 'Todas las secciones completadas.'
                                : `Te ${sections.length - currentSection - 1 === 1 ? 'queda' : 'quedan'} ${cuentaSecciones(sections.length - currentSection - 1)}.`)
                            : `Necesitas al menos ${needed} de ${total} para avanzar.`}
                    </p>

                    {passed && sectionScores.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-center mt-7">
                            {sectionScores.map((s, i) => (
                                <span key={i} className="text-[12px] font-bold px-2.5 py-1 rounded-lg"
                                    style={{ backgroundColor: c.realceSuave, color: c.realce }}>
                                    Sección {i + 1}: {s}%
                                </span>
                            ))}
                        </div>
                    )}
                </Columna>
            </Hoja>
        );
    }

    // ── RENDER: REFLEXIÓN FINAL ────────────────────────────────────────────────

    if (stage === 'REFLECTION') {
        const reflectionQuestion = courseMeta?.preguntaReflexion
            || 'Basándote en lo que aprendiste en este curso, describe una situación real en tu trabajo donde aplicarías este conocimiento. ¿Qué harías diferente a partir de hoy?';

        return (
            <Hoja c={c} tamano={tamano}
                cabecera={<>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: c.realce }}>
                            Reflexión final
                        </p>
                        <p className="text-[13px] font-bold truncate" style={{ fontFamily: SERIF, color: c.tinta }}>
                            {course.title}
                        </p>
                    </div>
                    <span className="text-[11px] font-bold flex-shrink-0 tabular-nums" style={{ color: c.suave }}>
                        Promedio {totalScore}%
                    </span>
                </>}
                pie={reflectionResult?.approved
                    ? <BotonPrincipal c={c} onClick={() => setStage('RESULT')}>Ver mi certificado</BotonPrincipal>
                    : <>
                        <BotonPrincipal c={c} onClick={handleReflection}
                            disabled={reflectionLoading || reflection.trim().length < 10}>
                            {reflectionLoading ? 'Leyendo tu respuesta…' : 'Enviar mi respuesta'}
                        </BotonPrincipal>
                        <div className="text-center mt-1">
                            <BotonDiscreto c={c} onClick={handleFail}>Dejarlo por hoy y volver después</BotonDiscreto>
                        </div>
                    </>}
            >
                <Columna tamano={tamano}>
                    {sectionScores.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-9">
                            {sectionScores.map((s, i) => (
                                <span key={i} className="text-[12px] font-bold px-2.5 py-1 rounded-lg"
                                    style={{ backgroundColor: c.realceSuave, color: c.realce }}>
                                    Sección {i + 1}: {s}%
                                </span>
                            ))}
                        </div>
                    )}

                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: c.suave }}>
                        Una última pregunta
                    </p>
                    <p className="font-bold leading-snug mb-8" style={{ fontFamily: SERIF, fontSize: 24, color: c.tinta }}>
                        {reflectionQuestion}
                    </p>

                    <textarea value={reflection} onChange={e => setReflection(e.target.value)}
                        placeholder="Escribe tu respuesta con tus palabras. Cuenta un caso tuyo: qué pasó y qué harías distinto."
                        rows={8}
                        className="w-full rounded-xl p-5 resize-none outline-none transition-colors"
                        style={{
                            backgroundColor: c.hoja, border: `1px solid ${c.filete}`, color: c.tinta,
                            fontFamily: SERIF, fontSize: 18, lineHeight: 1.7,
                        }}
                    />
                    <p className="text-[12px] mt-2" style={{ color: c.suave }}>
                        {reflection.length} caracteres — con 100 ya se puede evaluar bien.
                    </p>

                    {reflectionResult && (
                        <div className="mt-8 pt-5" style={{ borderTop: `2px solid ${reflectionResult.approved ? c.realce : c.fallo}` }}>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3"
                                style={{ color: reflectionResult.approved ? c.realce : c.fallo }}>
                                {reflectionResult.approved ? 'Aprobada' : 'Le falta un poco'}
                            </p>
                            <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.68, color: c.tinta }}>
                                {reflectionResult.feedback}
                            </p>
                            {!reflectionResult.approved && (
                                <button onClick={() => setReflectionResult(null)}
                                    className="mt-4 text-[13px] font-bold hover:opacity-70 transition-opacity"
                                    style={{ color: c.fallo }}>
                                    Mejorar mi respuesta
                                </button>
                            )}
                        </div>
                    )}
                </Columna>
            </Hoja>
        );
    }

    return null;
}
