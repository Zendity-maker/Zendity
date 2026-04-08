'use client';
import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { generateZendityCertificate } from './CertificateGenerator';

type Stage = 'IDLE' | 'LESSON_INTRO' | 'LESSON_BLOCKS' | 'BLOCK_CHECK' | 'QUIZ' | 'REFLECTION' | 'RESULT' | 'COMPLETED';

interface MCQ {
    question: string;
    options: string[];
    correct: number;
    explanation: string;
}

interface LessonBlock {
    title: string;
    content: string;
    checkQuestion?: string;
    checkOptions?: string[];
    checkCorrect?: number;
}

interface Props {
    course: any;
    user: any;
    initialStatus?: string;
    onCourseCompleted?: () => void;
}

export default function InteractiveCourseCard({ course, user, initialStatus, onCourseCompleted }: Props) {
    const [stage, setStage] = useState<Stage>(initialStatus === 'COMPLETED' ? 'COMPLETED' : 'IDLE');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Lesson
    const [blocks, setBlocks] = useState<LessonBlock[]>([]);
    const [currentBlock, setCurrentBlock] = useState(0);
    const [blockAnswer, setBlockAnswer] = useState<number | null>(null);
    const [blockFeedback, setBlockFeedback] = useState('');

    // Quiz
    const [questions, setQuestions] = useState<MCQ[]>([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [correctCount, setCorrectCount] = useState(0);
    const [quizAnswers, setQuizAnswers] = useState<boolean[]>([]);

    // Reflection
    const [reflection, setReflection] = useState('');
    const [reflectionResult, setReflectionResult] = useState<{ approved: boolean; feedback: string } | null>(null);
    const [reflectionLoading, setReflectionLoading] = useState(false);

    // Locks & strikes
    const [strikes, setStrikes] = useState(0);
    const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
    const [lockCountdown, setLockCountdown] = useState('');

    const hqId = (user as any)?.hqId || (user as any)?.headquartersId || '';

    // Check lock on mount
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

    // Lock countdown
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

    // Split course content into blocks
    const parseBlocks = useCallback((content: string): LessonBlock[] => {
        if (!content) return [];
        const sections = content.split(/(?=#{1,3}\s)/);
        return sections
            .filter(s => s.trim().length > 50)
            .slice(0, 5)
            .map(s => {
                const lines = s.trim().split('\n');
                const title = lines[0].replace(/^#+\s*/, '').trim() || 'Seccion';
                const body = lines.slice(1).join('\n').trim();
                return { title, content: body || s };
            });
    }, []);

    const startLesson = async () => {
        setLoading(true);
        setError('');
        try {
            if (course.content) {
                const parsed = parseBlocks(course.content);
                setBlocks(parsed.length > 0 ? parsed : [{ title: course.title, content: course.content }]);
            } else {
                // Generate flashcard-style blocks via AI
                const res = await fetch('/api/academy/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestType: 'flashcards', courseId: course.id })
                });
                const data = await res.json();
                const cards = data?.data?.flashcards || [];
                setBlocks(cards.map((c: any) => ({ title: c.title, content: c.content })));
            }
            setCurrentBlock(0);
            setStage('LESSON_INTRO');
        } catch (e) {
            setError('Error cargando el material. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const startQuiz = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/academy/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestType: 'quiz', courseId: course.id })
            });
            const data = await res.json();
            console.log('[Academy Quiz] API response:', JSON.stringify(data, null, 2));
            const quizData = data?.data?.quiz || [];
            if (quizData.length > 0) {
                setQuestions(quizData.map((q: any) => ({
                    question: q.question,
                    options: q.options,
                    correct: q.options.indexOf(q.correctAnswer),
                    explanation: q.explanation
                })));
                setCurrentQ(0);
                setCorrectCount(0);
                setQuizAnswers([]);
                setSelectedAnswer(null);
                setShowExplanation(false);
                setStage('QUIZ');
            } else {
                setError('No se pudo generar el examen. Intenta de nuevo.');
            }
        } catch (e) {
            setError('Error generando el examen.');
        } finally {
            setLoading(false);
        }
    };

    const handleBlockNext = () => {
        setBlockAnswer(null);
        setBlockFeedback('');
        if (currentBlock < blocks.length - 1) {
            setCurrentBlock(prev => prev + 1);
            setStage('LESSON_BLOCKS');
        } else {
            // All blocks done — go to quiz
            startQuiz();
        }
    };

    const handleAnswer = (idx: number) => {
        if (showExplanation) return;
        setSelectedAnswer(idx);
        setShowExplanation(true);
        const isCorrect = idx === questions[currentQ].correct;
        if (isCorrect) setCorrectCount(prev => prev + 1);
        setQuizAnswers(prev => [...prev, isCorrect]);
    };

    const handleNextQuestion = () => {
        if (currentQ < questions.length - 1) {
            setCurrentQ(prev => prev + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
        } else {
            // Quiz done — go to reflection
            setStage('REFLECTION');
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
                    userResponse: reflection
                })
            });
            const data = await res.json();
            const result = data?.data || data;
            setReflectionResult({ approved: result.approved, feedback: result.feedback });
            if (result.approved && correctCount >= Math.ceil(questions.length * 0.8)) {
                await completeCourse();
            }
        } catch {
            setReflectionResult({ approved: false, feedback: 'Error evaluando la respuesta. Intenta de nuevo.' });
        } finally {
            setReflectionLoading(false);
        }
    };

    const completeCourse = async () => {
        try {
            await fetch('/api/academy/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: user.id,
                    courseId: course.id,
                    hqId,
                    examScore: Math.round((correctCount / questions.length) * 100)
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

    const progressPct = questions.length > 0 ? Math.round((currentQ / questions.length) * 100) : 0;

    // -- LOCKED ---------------------------------------------------------------
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

    // -- COMPLETED ------------------------------------------------------------
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

    // -- RESULT ---------------------------------------------------------------
    if (stage === 'RESULT') return (
        <div className="bg-white rounded-2xl border border-teal-300 p-8 text-center">
            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🏆</span>
            </div>
            <h3 className="font-black text-slate-800 text-xl mb-2">Certificado obtenido!</h3>
            <p className="text-slate-500 mb-1">Puntuacion: <span className="font-black text-teal-600">{Math.round((correctCount / questions.length) * 100)}%</span></p>
            <p className="text-slate-500 text-sm mb-6">Has completado <span className="font-bold">{course.title}</span></p>
            <button
                onClick={() => generateZendityCertificate(user.name || 'Empleado', course.title, new Date().toLocaleDateString('es-PR'))}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-3 rounded-xl transition-all"
            >
                Descargar mi Certificado
            </button>
            <button onClick={() => setStage('COMPLETED')} className="w-full mt-2 text-slate-500 text-sm py-2">Cerrar</button>
        </div>
    );

    // -- IDLE -----------------------------------------------------------------
    if (stage === 'IDLE') return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
            {/* Course image */}
            {course.imageUrl ? (
                <img src={course.imageUrl} alt={course.title} className="w-full h-40 object-cover" />
            ) : (
                <div className="w-full h-40 bg-gradient-to-br from-teal-600 to-slate-800 flex items-center justify-center">
                    <span className="text-5xl">{course.emoji || '📘'}</span>
                </div>
            )}
            <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="font-black text-slate-800 text-sm leading-tight flex-1">{course.title}</h3>
                    {strikes > 0 && (
                        <span className="text-xs text-red-500 font-bold ml-2">{strikes}/3</span>
                    )}
                </div>
                <p className="text-slate-500 text-xs mb-4 line-clamp-2">{course.description}</p>
                <div className="flex gap-2">
                    <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2 py-1 rounded-full">
                        +{course.bonusCompliance || 50} PTS
                    </span>
                    <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full">
                        {course.durationMins || 15} min
                    </span>
                </div>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                <button
                    onClick={startLesson}
                    disabled={loading}
                    className="mt-4 w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all text-sm"
                >
                    {loading ? 'Cargando...' : 'Comenzar leccion'}
                </button>
            </div>
        </div>
    );

    // -- LESSON INTRO ---------------------------------------------------------
    if (stage === 'LESSON_INTRO') return (
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
                    Vamos a aprender <span className="text-teal-400 font-bold">{course.title}</span> en {blocks.length} bloques.
                    Despues tendras un examen de 5 preguntas y una pregunta de razonamiento que yo misma corregire.
                </p>
                <div className="flex gap-4 text-sm text-slate-500 mb-8">
                    <span>📚 {blocks.length} bloques</span>
                    <span>❓ 5 preguntas</span>
                    <span>💭 1 reflexion</span>
                    <span>🎓 Certificado</span>
                </div>
                <button
                    onClick={() => setStage('LESSON_BLOCKS')}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-black px-10 py-4 rounded-2xl transition-all text-lg"
                >
                    Empezamos! →
                </button>
            </div>
        </div>
    );

    // -- LESSON BLOCKS --------------------------------------------------------
    if (stage === 'LESSON_BLOCKS' && blocks.length > 0) {
        const block = blocks[currentBlock];
        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
                {/* Header */}
                <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                    <button onClick={() => setStage('IDLE')} className="text-slate-500 hover:text-white text-sm">✕</button>
                    <div className="flex gap-1">
                        {blocks.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all ${i < currentBlock ? 'bg-teal-500 w-6' : i === currentBlock ? 'bg-teal-400 w-8' : 'bg-slate-600 w-6'}`} />
                        ))}
                    </div>
                    <span className="text-slate-500 text-xs">{currentBlock + 1}/{blocks.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Block title */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-black">{currentBlock + 1}</span>
                        </div>
                        <h2 className="text-white font-black text-xl">{block.title}</h2>
                    </div>

                    {/* Content */}
                    <div className="bg-slate-800 rounded-2xl p-6 mb-6 prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                            components={{
                                h3: ({children}) => <h3 className="text-teal-400 font-bold text-base mt-4 mb-2">{children}</h3>,
                                p: ({children}) => <p className="text-slate-200 leading-relaxed mb-3">{children}</p>,
                                ul: ({children}) => <ul className="space-y-1 mb-3">{children}</ul>,
                                li: ({children}) => <li className="text-slate-300 flex gap-2"><span className="text-teal-400 flex-shrink-0">•</span><span>{children}</span></li>,
                                strong: ({children}) => <strong className="text-teal-300 font-bold">{children}</strong>,
                                blockquote: ({children}) => <blockquote className="border-l-4 border-teal-500 pl-4 italic text-slate-500">{children}</blockquote>,
                            }}
                        >
                            {block.content}
                        </ReactMarkdown>
                    </div>

                    {/* Zendi tip */}
                    <div className="bg-teal-900/40 border border-teal-700 rounded-xl p-4 mb-6 flex gap-3">
                        <span className="text-2xl flex-shrink-0">💡</span>
                        <div>
                            <p className="text-teal-400 text-xs font-bold mb-1">Zendi dice:</p>
                            <p className="text-slate-300 text-sm">
                                {currentBlock === 0
                                    ? 'Lee con calma. Cada bloque te prepara para las preguntas del examen.'
                                    : currentBlock === blocks.length - 1
                                    ? 'Ultimo bloque! Al terminar pasaremos al examen. Listo?'
                                    : 'Bien. Sigue asi. Estas construyendo el conocimiento paso a paso.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                    <button
                        onClick={handleBlockNext}
                        disabled={loading}
                        className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all"
                    >
                        {loading
                            ? 'Preparando examen...'
                            : currentBlock < blocks.length - 1
                            ? `Siguiente bloque →`
                            : 'Entendido! Ir al examen →'}
                    </button>
                </div>
            </div>
        );
    }

    // -- QUIZ -----------------------------------------------------------------
    if (stage === 'QUIZ' && questions.length > 0) {
        const q = questions[currentQ];
        const isLast = currentQ === questions.length - 1;

        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
                {/* Header */}
                <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                    <div>
                        <p className="text-teal-400 text-xs font-bold">EXAMEN OFICIAL</p>
                        <p className="text-white text-sm font-bold">{course.title}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-500 text-xs">{currentQ + 1} de {questions.length}</p>
                        <p className="text-teal-400 text-xs font-bold">{correctCount} correctas</p>
                    </div>
                </div>

                {/* Progress */}
                <div className="h-1.5 bg-slate-700">
                    <div className="h-full bg-teal-500 transition-all duration-500" style={{width: `${progressPct}%`}} />
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Question */}
                    <div className="bg-slate-800 rounded-2xl p-6 mb-6">
                        <p className="text-slate-500 text-xs font-bold mb-3 uppercase tracking-widest">Pregunta {currentQ + 1}</p>
                        <p className="text-white font-bold text-lg leading-relaxed">{q.question}</p>
                    </div>

                    {/* Options */}
                    <div className="space-y-3 mb-6">
                        {q.options.map((opt: string, i: number) => {
                            let style = 'border-slate-700 bg-slate-800 text-slate-200';
                            if (showExplanation) {
                                if (i === q.correct) style = 'border-teal-500 bg-teal-900/40 text-teal-300';
                                else if (i === selectedAnswer && i !== q.correct) style = 'border-red-500 bg-red-900/30 text-red-300';
                                else style = 'border-slate-700 bg-slate-800/50 text-slate-500';
                            } else if (selectedAnswer === i) {
                                style = 'border-teal-500 bg-teal-900/40 text-teal-300';
                            }
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleAnswer(i)}
                                    disabled={showExplanation}
                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all font-medium ${style}`}
                                >
                                    <span className="font-black mr-3 text-slate-500">{['A', 'B', 'C', 'D'][i]}.</span>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {/* Explanation */}
                    {showExplanation && (
                        <div className={`rounded-2xl p-5 mb-4 border ${selectedAnswer === q.correct ? 'bg-teal-900/30 border-teal-700' : 'bg-red-900/20 border-red-800'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{selectedAnswer === q.correct ? '✅' : '❌'}</span>
                                <p className={`font-black text-sm ${selectedAnswer === q.correct ? 'text-teal-400' : 'text-red-400'}`}>
                                    {selectedAnswer === q.correct ? 'Correcto!' : 'Incorrecto'}
                                </p>
                            </div>
                            <div className="flex gap-2 items-start">
                                <div className="w-7 h-7 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-black text-white">Z</span>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">{q.explanation}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {showExplanation && (
                    <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                        <button
                            onClick={handleNextQuestion}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl transition-all"
                        >
                            {isLast ? 'Ver pregunta de reflexion →' : 'Siguiente pregunta →'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // -- REFLECTION -----------------------------------------------------------
    if (stage === 'REFLECTION') {
        const passed = correctCount >= Math.ceil(questions.length * 0.8);
        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
                <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                    <div>
                        <p className="text-teal-400 text-xs font-bold">PREGUNTA DE RAZONAMIENTO</p>
                        <p className="text-white text-sm font-bold">{course.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${passed ? 'bg-teal-900 text-teal-400' : 'bg-red-900 text-red-400'}`}>
                            {correctCount}/{questions.length} correctas
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Score summary */}
                    <div className={`rounded-2xl p-4 mb-6 ${passed ? 'bg-teal-900/30 border border-teal-700' : 'bg-amber-900/20 border border-amber-700'}`}>
                        <p className={`font-black text-sm mb-1 ${passed ? 'text-teal-400' : 'text-amber-400'}`}>
                            {passed ? `Excelente! ${correctCount} de ${questions.length} correctas` : `${correctCount} de ${questions.length} correctas — necesitas la reflexion para aprobar`}
                        </p>
                        <p className="text-slate-500 text-xs">
                            {passed
                                ? 'Supera la reflexion final para obtener tu certificado.'
                                : 'Esta es tu oportunidad de demostrar que entendiste el material.'}
                        </p>
                    </div>

                    {/* Zendi question */}
                    <div className="bg-slate-800 rounded-2xl p-6 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-lg">👩‍🏫</span>
                            </div>
                            <div>
                                <p className="text-teal-400 text-xs font-bold">Profesora Zendi pregunta:</p>
                            </div>
                        </div>
                        <p className="text-white font-bold text-lg leading-relaxed">
                            Basandote en lo que aprendiste en este curso, describe una situacion real en tu trabajo donde aplicarias este conocimiento. Que harias diferente a partir de hoy?
                        </p>
                    </div>

                    {/* Text area */}
                    <textarea
                        value={reflection}
                        onChange={e => setReflection(e.target.value)}
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
                                <button
                                    onClick={() => { setReflectionResult(null); }}
                                    className="mt-3 text-amber-400 text-xs font-bold hover:text-amber-300"
                                >
                                    Mejorar mi respuesta
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(!reflectionResult || !reflectionResult.approved) && (
                    <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                        <button
                            onClick={handleReflection}
                            disabled={reflectionLoading || reflection.trim().length < 10}
                            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-black py-4 rounded-2xl transition-all"
                        >
                            {reflectionLoading ? 'Zendi esta evaluando...' : 'Enviar respuesta a Zendi →'}
                        </button>
                        {!passed && (
                            <button
                                onClick={handleFail}
                                className="w-full mt-2 text-slate-500 text-xs py-2 hover:text-slate-500"
                            >
                                Abandonar y reintentar despues
                            </button>
                        )}
                    </div>
                )}
                {reflectionResult?.approved && (
                    <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                        <button
                            onClick={() => setStage('RESULT')}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl transition-all"
                        >
                            Ver mi certificado 🎓
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
