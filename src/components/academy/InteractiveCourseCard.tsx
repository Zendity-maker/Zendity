'use client';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { generateZendityCertificate } from './CertificateGenerator';

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

// ── Component ──────────────────────────────────────────────────────────────────

export default function InteractiveCourseCard({ course, user, initialStatus, onCourseCompleted }: Props) {
    const [stage, setStage] = useState<Stage>(initialStatus === 'COMPLETED' ? 'COMPLETED' : 'IDLE');
    const [error, setError] = useState('');

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
    const [lockCountdown, setLockCountdown] = useState('');

    const hqId = (user as any)?.hqId || (user as any)?.headquartersId || '';

    // ── Effects ────────────────────────────────────────────────────────────────

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

    const startLesson = () => {
        setError('');
        if (!course.content) { setError('Este curso no tiene contenido disponible.'); return; }

        const { meta, sections: parsed } = parseCourseContent(course.content);
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
        try {
            await fetch('/api/academy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: user.id,
                    courseId: course.id,
                    hqId,
                    examScore: totalScore
                })
            });
            setStage('RESULT');
            if (onCourseCompleted) onCourseCompleted();
        } catch {
            setStage('RESULT');
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

    // ── RENDER: LOCKED ─────────────────────────────────────────────────────────

    if (lockedUntil) return (
        <div className="bg-white rounded-2xl border border-red-200 p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🔒</span>
            </div>
            <h3 className="font-black text-slate-800 mb-1">{course.title}</h3>
            <p className="text-red-600 font-bold text-sm mb-1">Acceso bloqueado temporalmente</p>
            <p className="text-slate-500 text-xs">Se desbloquea en <span className="font-bold text-red-500">{lockCountdown}</span></p>
            <p className="text-slate-500 text-xs mt-2">3 intentos fallidos — periodo de reflexion de 24 horas</p>
        </div>
    );

    // ── RENDER: COMPLETED ──────────────────────────────────────────────────────

    if (stage === 'COMPLETED' || initialStatus === 'COMPLETED') return (
        <div className="bg-white rounded-2xl border border-teal-200 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🎓</span>
                </div>
                <div>
                    <h3 className="font-black text-slate-800 text-sm">{course.title}</h3>
                    <p className="text-teal-600 text-xs font-bold">Certificado completado</p>
                </div>
            </div>
            <button
                onClick={() => generateZendityCertificate(user.name || 'Empleado', course.title, new Date().toLocaleDateString('es-PR'))}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm py-2.5 rounded-xl transition-all"
            >
                Imprimir Certificado Zendity
            </button>
        </div>
    );

    // ── RENDER: RESULT ─────────────────────────────────────────────────────────

    if (stage === 'RESULT') return (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-8">
            <div className="w-20 h-20 bg-teal-700 rounded-full flex items-center justify-center mb-6 border-4 border-teal-500">
                <span className="text-4xl">🏆</span>
            </div>
            <h3 className="text-white font-black text-2xl mb-2">Certificado obtenido!</h3>
            <p className="text-slate-400 mb-1">Puntuacion promedio: <span className="font-black text-teal-400">{totalScore}%</span></p>
            <p className="text-slate-500 text-sm mb-2">{sections.length} secciones completadas</p>
            <div className="flex flex-wrap gap-2 mb-6 justify-center">
                {sectionScores.map((s, i) => (
                    <span key={i} className="bg-teal-900/50 text-teal-400 text-xs font-bold px-2 py-1 rounded-lg">
                        S{i + 1}: {s}%
                    </span>
                ))}
            </div>
            <p className="text-slate-500 text-sm mb-8">Has completado <span className="font-bold text-white">{course.title}</span></p>
            <button
                onClick={() => generateZendityCertificate(user.name || 'Empleado', course.title, new Date().toLocaleDateString('es-PR'))}
                className="w-full max-w-sm bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl transition-all"
            >
                Descargar mi Certificado
            </button>
            <button onClick={() => setStage('COMPLETED')} className="mt-3 text-slate-500 text-sm py-2 hover:text-slate-400">Cerrar</button>
        </div>
    );

    // ── RENDER: IDLE ───────────────────────────────────────────────────────────

    if (stage === 'IDLE') return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
            {course.imageUrl ? (
                <img src={course.imageUrl} alt={course.title} className="w-full h-40 object-cover"
                    onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                            const fallback = document.createElement('div');
                            fallback.style.cssText = 'width:100%;height:160px;background:linear-gradient(135deg,#0F6E56,#1E293B);display:flex;align-items:center;justify-content:center;';
                            fallback.innerHTML = '<span style="font-size:3rem;">📘</span>';
                            parent.insertBefore(fallback, target);
                        }
                    }}
                />
            ) : (
                <div className="w-full h-40 bg-gradient-to-br from-teal-600 to-slate-800 flex items-center justify-center">
                    <span className="text-5xl">{course.emoji || '📘'}</span>
                </div>
            )}
            <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="font-black text-slate-800 text-sm leading-tight flex-1">{course.title}</h3>
                    {strikes > 0 && <span className="text-xs text-red-500 font-bold ml-2">{strikes}/3</span>}
                </div>
                <p className="text-slate-500 text-xs mb-4 line-clamp-2">{course.description}</p>
                <div className="flex gap-2">
                    <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2 py-1 rounded-full">+{course.bonusCompliance || 50} PTS</span>
                    <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full">{course.durationMins || 15} min</span>
                </div>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                <button onClick={startLesson}
                    className="mt-4 w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-3 rounded-xl transition-all text-sm">
                    Comenzar leccion
                </button>
            </div>
        </div>
    );

    // ── RENDER: INTRO ──────────────────────────────────────────────────────────

    if (stage === 'INTRO') return (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
            <div className="bg-teal-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-black">Z</span>
                    </div>
                    <div>
                        <p className="text-teal-200 text-xs">Profesora Zendi</p>
                        <p className="text-white font-black text-sm">{course.title}</p>
                    </div>
                </div>
                <button onClick={() => setStage('IDLE')} className="text-white/60 hover:text-white text-sm">✕</button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-teal-700 rounded-full flex items-center justify-center mb-6 border-4 border-teal-500">
                    <span className="text-4xl">👩‍🏫</span>
                </div>
                <h2 className="text-white font-black text-2xl mb-3">Hola! Soy Zendi</h2>
                <p className="text-slate-300 text-lg mb-2">Tu profesora para este curso.</p>
                <p className="text-slate-500 max-w-md mb-4">
                    Vamos a estudiar <span className="text-teal-400 font-bold">{course.title}</span> en {sections.length} secciones.
                    Cada seccion tiene una lectura y preguntas que debes aprobar al 80% para avanzar.
                    Al final, una pregunta de reflexion que yo misma corregire.
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-8 justify-center">
                    <span>📖 {sections.length} secciones</span>
                    <span>❓ {sections.reduce((a, s) => a + s.preguntas.length, 0)} preguntas</span>
                    <span>💭 1 reflexion</span>
                    <span>🎓 Certificado</span>
                </div>
                <button onClick={goToReading}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-black px-10 py-4 rounded-2xl transition-all text-lg">
                    Empezamos! →
                </button>
            </div>
        </div>
    );

    // ── RENDER: READING ────────────────────────────────────────────────────────

    if (stage === 'READING' && sections.length > 0) {
        const section = sections[currentSection];
        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
                {/* Header with section progress */}
                <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                    <button onClick={() => setStage('IDLE')} className="text-slate-500 hover:text-white text-sm">✕</button>
                    <div className="flex gap-1.5">
                        {sections.map((_, i) => (
                            <div key={i} className={`h-2 rounded-full transition-all ${
                                i < currentSection ? 'bg-teal-500 w-6' :
                                i === currentSection ? 'bg-teal-400 w-8' :
                                'bg-slate-600 w-6'
                            }`} />
                        ))}
                    </div>
                    <span className="text-slate-500 text-xs font-bold">Seccion {currentSection + 1}/{sections.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Section title */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-black">{currentSection + 1}</span>
                        </div>
                        <h2 className="text-white font-black text-xl">{section.title}</h2>
                    </div>

                    {/* Lecture content */}
                    <div className="bg-slate-800 rounded-2xl p-6 mb-6 prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown components={{
                            h1: ({children}) => <h1 className="text-teal-400 font-black text-lg mt-2 mb-3">{children}</h1>,
                            h2: ({children}) => <h2 className="text-teal-400 font-bold text-base mt-4 mb-2">{children}</h2>,
                            h3: ({children}) => <h3 className="text-teal-400 font-bold text-base mt-4 mb-2">{children}</h3>,
                            p: ({children}) => <p className="text-slate-200 leading-relaxed mb-3">{children}</p>,
                            ul: ({children}) => <ul className="space-y-1 mb-3">{children}</ul>,
                            li: ({children}) => <li className="text-slate-300 flex gap-2"><span className="text-teal-400 flex-shrink-0">•</span><span>{children}</span></li>,
                            strong: ({children}) => <strong className="text-teal-300 font-bold">{children}</strong>,
                            blockquote: ({children}) => <blockquote className="border-l-4 border-teal-500 pl-4 italic text-slate-400">{children}</blockquote>,
                        }}>
                            {section.lectura}
                        </ReactMarkdown>
                    </div>

                    {/* Zendi tip */}
                    <div className="bg-teal-900/40 border border-teal-700 rounded-xl p-4 flex gap-3">
                        <span className="text-2xl flex-shrink-0">💡</span>
                        <div>
                            <p className="text-teal-400 text-xs font-bold mb-1">Zendi dice:</p>
                            <p className="text-slate-300 text-sm">
                                {currentSection === 0
                                    ? `Lee con calma. Al terminar responderas ${section.preguntas.length} preguntas sobre esta seccion.`
                                    : currentSection === sections.length - 1
                                    ? 'Ultima seccion! Despues de las preguntas viene tu reflexion final.'
                                    : `Seccion ${currentSection + 1} de ${sections.length}. Necesitas 80% para avanzar.`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                    <button onClick={goToSectionQuiz}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl transition-all">
                        {section.preguntas.length > 0
                            ? `Ir a las preguntas (${section.preguntas.length}) →`
                            : 'Continuar →'}
                    </button>
                </div>
            </div>
        );
    }

    // ── RENDER: SECTION QUIZ ───────────────────────────────────────────────────

    if (stage === 'SECTION_QUIZ' && sections[currentSection]?.preguntas.length > 0) {
        const section = sections[currentSection];
        const q = section.preguntas[currentQ];
        const isLastQ = currentQ === section.preguntas.length - 1;

        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
                {/* Header */}
                <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                    <div>
                        <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">Seccion {currentSection + 1} — Preguntas</p>
                        <p className="text-white text-sm font-bold">{section.title}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-500 text-xs">{currentQ + 1} de {section.preguntas.length}</p>
                        <p className="text-teal-400 text-xs font-bold">{sectionCorrect} correctas</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-slate-700">
                    <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${sectionQuizProgress}%` }} />
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Question */}
                    <div className="bg-slate-800 rounded-2xl p-6 mb-6">
                        <p className="text-slate-500 text-xs font-bold mb-3 uppercase tracking-widest">Pregunta {currentQ + 1}</p>
                        <p className="text-white font-bold text-lg leading-relaxed">{q.question}</p>
                    </div>

                    {/* Options */}
                    <div className="space-y-3 mb-6">
                        {q.options.map((opt, i) => {
                            let style = 'border-slate-700 bg-slate-800 text-slate-200';
                            if (showExplanation) {
                                if (i === q.correctIndex) style = 'border-teal-500 bg-teal-900/40 text-teal-300';
                                else if (i === selectedAnswer && i !== q.correctIndex) style = 'border-red-500 bg-red-900/30 text-red-300';
                                else style = 'border-slate-700 bg-slate-800/50 text-slate-500';
                            } else if (selectedAnswer === i) {
                                style = 'border-teal-500 bg-teal-900/40 text-teal-300';
                            }
                            return (
                                <button key={i} onClick={() => handleAnswer(i)} disabled={showExplanation}
                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all font-medium ${style}`}>
                                    <span className="font-black mr-3 text-slate-500">{['A', 'B', 'C', 'D'][i]}.</span>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {/* Explanation */}
                    {showExplanation && (
                        <div className={`rounded-2xl p-5 mb-4 border ${
                            selectedAnswer === q.correctIndex ? 'bg-teal-900/30 border-teal-700' : 'bg-red-900/20 border-red-800'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{selectedAnswer === q.correctIndex ? '✅' : '❌'}</span>
                                <p className={`font-black text-sm ${selectedAnswer === q.correctIndex ? 'text-teal-400' : 'text-red-400'}`}>
                                    {selectedAnswer === q.correctIndex ? 'Correcto!' : 'Incorrecto'}
                                </p>
                            </div>
                            {q.explanation && (
                                <div className="flex gap-2 items-start">
                                    <div className="w-7 h-7 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs font-black text-white">Z</span>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed">{q.explanation}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {showExplanation && (
                    <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                        <button onClick={handleNextQuestion}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl transition-all">
                            {isLastQ ? 'Ver resultado de seccion →' : 'Siguiente pregunta →'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ── RENDER: SECTION RESULT ────────────────────────────────────────────────

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
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-8">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border-4 ${
                    passed ? 'bg-teal-700 border-teal-500' : 'bg-amber-900/50 border-amber-600'
                }`}>
                    <span className="text-4xl">{passed ? '✅' : '📖'}</span>
                </div>

                <h3 className="text-white font-black text-xl mb-2">
                    {passed ? `Seccion ${currentSection + 1} aprobada!` : `Seccion ${currentSection + 1} no aprobada`}
                </h3>

                <p className={`font-bold mb-1 ${passed ? 'text-teal-400' : 'text-amber-400'}`}>
                    {sectionCorrect}/{total} correctas ({pct}%)
                </p>

                {passed ? (
                    <p className="text-slate-500 text-sm mb-8">
                        {isLast ? 'Todas las secciones completadas!' : `Faltan ${sections.length - currentSection - 1} secciones mas.`}
                    </p>
                ) : (
                    <p className="text-slate-500 text-sm mb-8">
                        Necesitas al menos {needed}/{total} (80%) para avanzar.
                    </p>
                )}

                {passed && sectionScores.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-8 justify-center">
                        {sectionScores.map((s, i) => (
                            <span key={i} className="bg-teal-900/50 text-teal-400 text-xs font-bold px-2.5 py-1 rounded-lg">
                                S{i + 1}: {s}%
                            </span>
                        ))}
                    </div>
                )}

                {passed ? (
                    <button onClick={handleContinue}
                        className="w-full max-w-sm bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl transition-all">
                        {isLast ? 'Ir a la reflexion final →' : 'Siguiente seccion →'}
                    </button>
                ) : (
                    <>
                        <button onClick={goToReading}
                            className="w-full max-w-sm bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl transition-all mb-3">
                            Releer seccion y reintentar →
                        </button>
                        <button onClick={handleFail}
                            className="text-slate-500 text-xs py-2 hover:text-slate-400">
                            Abandonar curso ({strikes + 1}/3 intento)
                        </button>
                    </>
                )}
            </div>
        );
    }

    // ── RENDER: REFLECTION ─────────────────────────────────────────────────────

    if (stage === 'REFLECTION') {
        const reflectionQuestion = courseMeta?.preguntaReflexion
            || 'Basandote en lo que aprendiste en este curso, describe una situacion real en tu trabajo donde aplicarias este conocimiento. Que harias diferente a partir de hoy?';

        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
                <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                    <div>
                        <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">Reflexion Final</p>
                        <p className="text-white text-sm font-bold">{course.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-teal-900 text-teal-400">
                            Promedio: {totalScore}%
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Score summary */}
                    <div className="rounded-2xl p-4 mb-6 bg-teal-900/30 border border-teal-700">
                        <p className="text-teal-400 font-black text-sm mb-2">Todas las secciones aprobadas!</p>
                        <div className="flex flex-wrap gap-2">
                            {sectionScores.map((s, i) => (
                                <span key={i} className="bg-teal-900/50 text-teal-400 text-xs font-bold px-2 py-1 rounded-lg">
                                    S{i + 1}: {s}%
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Zendi question */}
                    <div className="bg-slate-800 rounded-2xl p-6 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-lg">👩‍🏫</span>
                            </div>
                            <p className="text-teal-400 text-xs font-bold">Profesora Zendi pregunta:</p>
                        </div>
                        <p className="text-white font-bold text-lg leading-relaxed">{reflectionQuestion}</p>
                    </div>

                    {/* Textarea */}
                    <textarea value={reflection} onChange={e => setReflection(e.target.value)}
                        placeholder="Escribe tu respuesta aqui. Se especifico — Zendi evaluara la profundidad de tu comprension..."
                        rows={6}
                        className="w-full bg-slate-800 border border-slate-600 focus:border-teal-500 rounded-2xl p-4 text-white text-sm resize-none outline-none mb-2 placeholder:text-slate-600"
                    />
                    <p className="text-slate-600 text-xs mb-4">{reflection.length} caracteres — minimo recomendado: 100</p>

                    {/* Feedback from Zendi */}
                    {reflectionResult && (
                        <div className={`rounded-2xl p-5 mb-4 border ${reflectionResult.approved ? 'bg-teal-900/30 border-teal-700' : 'bg-amber-900/20 border-amber-700'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm">👩‍🏫</span>
                                </div>
                                <p className={`font-black text-sm ${reflectionResult.approved ? 'text-teal-400' : 'text-amber-400'}`}>
                                    {reflectionResult.approved ? 'Excelente reflexion!' : 'Zendi tiene un comentario para ti:'}
                                </p>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed">{reflectionResult.feedback}</p>
                            {!reflectionResult.approved && (
                                <button onClick={() => setReflectionResult(null)}
                                    className="mt-3 text-amber-400 text-xs font-bold hover:text-amber-300">
                                    Mejorar mi respuesta
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(!reflectionResult || !reflectionResult.approved) && (
                    <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                        <button onClick={handleReflection}
                            disabled={reflectionLoading || reflection.trim().length < 10}
                            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-black py-4 rounded-2xl transition-all">
                            {reflectionLoading ? 'Zendi esta evaluando...' : 'Enviar respuesta a Zendi →'}
                        </button>
                        <button onClick={handleFail}
                            className="w-full mt-2 text-slate-500 text-xs py-2 hover:text-slate-400">
                            Abandonar y reintentar despues
                        </button>
                    </div>
                )}
                {reflectionResult?.approved && (
                    <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                        <button onClick={() => setStage('RESULT')}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl transition-all">
                            Ver mi certificado 🎓
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
