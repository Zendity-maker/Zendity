import React, { useState, useEffect } from "react";
import Object from "jspdf";
import ReactMarkdown from "react-markdown";
import { generateZendityCertificate } from "./CertificateGenerator";
export default function InteractiveCourseCard({
    course,
    user,
    initialStatus,
    onCourseCompleted
}: {
    course: any,
    user: any,
    initialStatus: string,
    onCourseCompleted: () => void
}) {
    const [status, setStatus] = useState(initialStatus);
    const [mode, setMode] = useState<"IDLE" | "LEARNING" | "QUIZ">("IDLE");

    // AI Data
    const [flashcards, setFlashcards] = useState<any[]>([]);
    const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
    const [activeCardIndex, setActiveCardIndex] = useState(0);
    const [aiLoading, setAiLoading] = useState(false);

    // Reflection State
    const [reflectionAnswer, setReflectionAnswer] = useState("");
    const [reflectionFeedback, setReflectionFeedback] = useState<any>(null);
    const [isSubmittingReflection, setIsSubmittingReflection] = useState(false);

    // Quiz State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
    const [score, setScore] = useState(0);

    // 3 Strikes Logic
    const [lockedUntil, setLockedUntil] = useState<string | null>(null);
    const [strikes, setStrikes] = useState(0);

    // Fetch UserCourse status to check locks on mount
    useEffect(() => {
        const checkLockStatus = async () => {
            try {
                const res = await fetch(`/api/academy?hqId=${user?.hqId || user?.headquartersId}&employeeId=${user?.id}`);
                const data = await res.json();
                if (data.success) {
                    const myEnrollment = data.enrollments.find((e: any) => e.courseId === course.id);
                    if (myEnrollment) {
                        setStrikes(myEnrollment.attemptsCount || 0);
                        if (myEnrollment.lockedUntil && new Date(myEnrollment.lockedUntil) > new Date()) {
                            setLockedUntil(myEnrollment.lockedUntil);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };
        if (status !== 'COMPLETED') {
            checkLockStatus();
        }
    }, [course.id, user, status]);

    const handleStartLearning = async () => {
        if (course.content) {
            setMode("LEARNING");
            return;
        }

        if (flashcards.length > 0) {
            setMode("LEARNING");
            setActiveCardIndex(0);
            return;
        }

        setAiLoading(true);
        try {
            const res = await fetch("/api/academy/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestType: "flashcards", courseId: course.id })
            });
            const data = await res.json();
            if (data.success && data.data.flashcards) {
                setFlashcards(data.data.flashcards);
                setMode("LEARNING");
            } else {
                alert("Error generando contenido de estudio. Intenta de nuevo.");
            }
        } catch (e) {
            alert("Error de conexión con Gemini 1.5 Pro");
        } finally {
            setAiLoading(false);
        }
    };

    const submitReflection = async () => {
        setIsSubmittingReflection(true);
        try {
            const res = await fetch("/api/academy/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestType: "reflection", courseId: course.id, userResponse: reflectionAnswer })
            });
            const data = await res.json();
            if (data.success && data.data) {
                setReflectionFeedback(data.data);
            } else {
                alert("Error validando reflexión. Intenta de nuevo.");
            }
        } catch (e) {
            alert("Error de conexión con Zendity AI");
        } finally {
            setIsSubmittingReflection(false);
        }
    };

    const handleStartQuiz = async () => {
        if (lockedUntil && new Date(lockedUntil) > new Date()) {
            alert(`Acceso denegado. Curso bloqueado hasta: ${new Date(lockedUntil).toLocaleString()}`);
            return;
        }

        setAiLoading(true);
        try {
            const res = await fetch("/api/academy/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestType: "quiz", courseId: course.id })
            });
            const data = await res.json();
            if (data.success && data.data.quiz) {
                setQuizQuestions(data.data.quiz);
                setMode("QUIZ");
                setCurrentQuestionIndex(0);
                setSelectedAnswer(null);
                setIsAnswerRevealed(false);
                setScore(0);
            } else {
                alert("Error generando el examen. Intenta de nuevo.");
            }
        } catch (e) {
            alert("Error de conexión con Gemini 1.5 Pro");
        } finally {
            setAiLoading(false);
        }
    };

    const handleAnswerSubmit = () => {
        if (!selectedAnswer) return;

        const isCorrect = selectedAnswer === quizQuestions[currentQuestionIndex].correctAnswer;
        if (isCorrect) setScore(score + 1);
        setIsAnswerRevealed(true);
    };

    const handleNextQuestion = async () => {
        if (currentQuestionIndex + 1 < quizQuestions.length) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelectedAnswer(null);
            setIsAnswerRevealed(false);
        } else {
            // EXAMEN FINALIZADO
            setAiLoading(true);
            const totalQuestions = quizQuestions.length;
            const finalScore = score + (selectedAnswer === quizQuestions[currentQuestionIndex].correctAnswer && !isAnswerRevealed ? 1 : 0);
            const passed = finalScore === totalQuestions;

            if (passed) {
                // SUCCESS
                const res = await fetch('/api/academy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employeeId: user?.id, hqId: user?.hqId || user?.headquartersId, courseId: course.id, examScore: 100 })
                });

                if (res.ok) {
                    setStatus('COMPLETED');
                    alert("🎉 ¡Excelencia Zendity! Has aprobado el curso con 100%. Tu credencial oficial de Zendity Certified ha sido generada.");
                    onCourseCompleted();
                    setMode("IDLE");
                }
            } else {
                // FAILURE - Log attempt
                const res = await fetch('/api/academy/attempt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employeeId: user?.id, hqId: user?.hqId || user?.headquartersId, courseId: course.id })
                });
                const data = await res.json();

                if (data.locked) {
                    setLockedUntil(data.lockedUntil);
                    setStrikes(3);
                    alert(`❌ REPROBADO. Has alcanzado el límite de 3 intentos fallidos. Por seguridad operativa, este curso ha sido BLOQUEADO por 24 horas. Zendity HR ha sido notificado.`);
                } else {
                    setStrikes(data.newAttemptCount);
                    alert(`❌ REPROBADO. Puntuación: ${finalScore}/${totalQuestions}. Intento ${data.newAttemptCount}/3. Repasa las tarjetas de estudio e inténtalo de nuevo.`);
                }
                setMode("IDLE");
            }
            setAiLoading(false);
        }
    };

    if (lockedUntil && new Date(lockedUntil) > new Date()) {
        return (
            <div className="bg-slate-50 rounded-2xl p-6 shadow-sm border border-red-200 opacity-80 relative overflow-hidden flex flex-col items-center justify-center min-h-[250px] text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mb-4">🔒</div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Acceso Restringido (24 Horas)</h4>
                <p className="text-sm text-gray-600 mb-4 max-w-sm">Has fallado la Certificación Zendity 3 veces consecutivas. Como medida de seguridad clínica, debes repasar el material con tu Supervisor antes de reintentar.</p>
                <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold font-mono text-slate-500 shadow-sm">
                    Desbloqueo automático: {new Date(lockedUntil).toLocaleString()}
                </div>
            </div>
        );
    }

    if (mode === "LEARNING") {
        if (course.content && flashcards.length === 0) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-900/90 backdrop-blur-md overflow-hidden">
                    <div className="bg-white rounded-[2.5rem] p-0 shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
                        
                        {/* Header Sticky */}
                        <div className="flex justify-between items-center p-6 md:px-10 md:py-8 bg-white border-b border-slate-100 sticky top-0 z-10">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full w-fit">
                                    Lectura Oficial (Zendity Academy)
                                </span>
                                <h3 className="text-xl md:text-2xl font-black text-slate-900">{course.title}</h3>
                            </div>
                            <button onClick={() => setMode("IDLE")} className="text-sm font-bold text-slate-400 hover:text-white bg-slate-50 hover:bg-rose-500 px-6 py-3 rounded-2xl transition-all shadow-sm">
                                ✕ Cerrar
                            </button>
                        </div>
                        
                        {/* Contenido Scrolleable */}
                        <div className="flex-1 overflow-y-auto px-6 md:px-12 py-8 bg-slate-50/50 text-slate-700 text-lg leading-relaxed">
                            <ReactMarkdown 
                                components={{
                                    h3: ({node, ...props}) => <h3 className="text-2xl md:text-3xl font-black text-slate-900 mt-10 mb-6 pb-2 border-b-2 border-indigo-100" {...props} />,
                                    p: ({node, ...props}) => <p className="mb-6" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-6 space-y-3" {...props} />,
                                    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-6 space-y-3 font-bold text-slate-900" {...props} />,
                                    li: ({node, ...props}) => <li className="text-slate-600 font-medium leading-relaxed" {...props} />,
                                    strong: ({node, ...props}) => <strong className="font-extrabold text-slate-900 bg-indigo-50 px-1 rounded" {...props} />,
                                    em: ({node, ...props}) => <em className="text-indigo-600 font-semibold" {...props} />,
                                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/60 p-6 md:p-8 rounded-r-3xl text-indigo-900 my-8 shadow-sm flex flex-col gap-2" {...props} />,
                                    hr: ({node, ...props}) => <hr className="my-10 border-slate-200 border-2 rounded-full" {...props} />
                                }}
                            >
                                {course.content}
                            </ReactMarkdown>
                            
                            {/* Reflexión y Evaluación Interactiva */}
                            <div className="mt-12 bg-white rounded-3xl p-6 md:p-8 border-2 border-indigo-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                                <h4 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2"><span>🧠</span> Dinámica de Reflexión Práctica</h4>
                                <p className="text-slate-600 mb-6 text-base font-medium">
                                    Busca el bloque de "Dinámica de Reflexión" o "Ejercicio Práctico" en el material superior y redacta tu respuesta profesional. Tu Coordinadora (Zendi AI) evaluará éticamente tus decisiones.
                                </p>
                                
                                {!reflectionFeedback ? (
                                    <>
                                        <textarea 
                                            value={reflectionAnswer}
                                            onChange={(e) => setReflectionAnswer(e.target.value)}
                                            placeholder="Escribe tu reflexión detallada aquí..."
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 min-h-[120px] focus:outline-none focus:border-indigo-500 transition-colors text-base resize-none"
                                        />
                                        <div className="mt-4 flex justify-end">
                                            <button 
                                                onClick={submitReflection}
                                                disabled={isSubmittingReflection || reflectionAnswer.trim().length < 10}
                                                className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all flex items-center gap-2"
                                            >
                                                {isSubmittingReflection ? "Zendi Evaluando..." : "Enviar Reflexión"}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className={`p-6 rounded-2xl border shadow-sm ${reflectionFeedback.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                        <div className="flex items-start gap-4">
                                            <div className="text-3xl">{reflectionFeedback.approved ? '✅' : '❌'}</div>
                                            <div>
                                                <p className={`font-black text-lg mb-2 ${reflectionFeedback.approved ? 'text-emerald-800' : 'text-rose-800'}`}>
                                                    {reflectionFeedback.approved ? '¡Reflexión Aprobada!' : 'Respuesta No Apta'}
                                                </p>
                                                <p className="text-slate-700 text-sm leading-relaxed"><strong className="text-slate-900">Zendi Feedback:</strong> {reflectionFeedback.feedback}</p>
                                                {!reflectionFeedback.approved && (
                                                    <button onClick={() => setReflectionFeedback(null)} className="mt-4 text-sm font-bold text-rose-600 hover:text-rose-800 underline">
                                                        Intentar de nuevo cambiando el enfoque
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Footer Sticky */}
                        <div className="p-6 md:px-10 bg-white border-t border-slate-100 flex justify-end sticky bottom-0 z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                            <button 
                                onClick={() => {
                                    setMode("IDLE");
                                    setReflectionFeedback(null);
                                    setReflectionAnswer("");
                                }} 
                                disabled={!reflectionFeedback?.approved}
                                className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-lg font-black shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 transition-all disabled:bg-slate-300 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
                            >
                                {reflectionFeedback?.approved ? 'Terminar Lectura y Volver 🎓' : 'Debes Aprobar la Reflexión 🔒'}
                            </button>
                        </div>

                    </div>
                </div>
            );
        }

        const card = flashcards[activeCardIndex];
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
                <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-200 w-full max-w-4xl min-h-[500px] flex flex-col animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center mb-8">
                        <span className="text-sm font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-4 py-1.5 rounded-full">
                            Material de Estudio • Tarjeta {activeCardIndex + 1} de {flashcards.length}
                        </span>
                        <button onClick={() => setMode("IDLE")} className="text-sm font-bold text-slate-400 hover:text-rose-500 transition-colors bg-slate-100 hover:bg-rose-50 px-4 py-2 rounded-xl">
                            ✕ Cerrar Sesión
                        </button>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center items-center text-center px-4 md:px-16 py-12 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-2xl border border-indigo-100 mb-8">
                        <h3 className="text-4xl md:text-5xl font-black text-slate-800 mb-8 leading-tight tracking-tight">{card.title}</h3>
                        <p className="text-xl md:text-2xl text-slate-600 leading-relaxed font-medium max-w-2xl">{card.content}</p>
                    </div>

                    <div className="flex justify-between items-center mt-auto border-t border-slate-100 pt-6">
                        <button
                            onClick={() => setActiveCardIndex(Math.max(0, activeCardIndex - 1))}
                            disabled={activeCardIndex === 0}
                            className="px-8 py-3.5 text-base font-bold text-slate-600 bg-slate-100 disabled:opacity-30 disabled:hover:bg-slate-100 hover:bg-slate-200 hover:text-indigo-700 rounded-2xl transition-all"
                        >
                            ← Anterior
                        </button>
                        
                        <div className="flex gap-2">
                            {flashcards.map((_, idx) => (
                                <div key={idx} className={`h-2 rounded-full transition-all duration-300 ${idx === activeCardIndex ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'}`} />
                            ))}
                        </div>

                        {activeCardIndex + 1 === flashcards.length ? (
                            <button onClick={() => setMode("IDLE")} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-base font-bold shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 transition-all">
                                Entendido 🎓
                            </button>
                        ) : (
                            <button onClick={() => setActiveCardIndex(activeCardIndex + 1)} className="px-8 py-3.5 bg-indigo-100 text-indigo-700 rounded-2xl text-base font-bold hover:bg-indigo-200 hover:scale-105 transition-all">
                                Siguiente →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (mode === "QUIZ") {
        const q = quizQuestions[currentQuestionIndex];
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-lg overflow-y-auto">
                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl border-2 border-indigo-100 w-full max-w-4xl min-h-[600px] flex flex-col animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-100">
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full w-fit">
                                Examen Oficial de Certificación
                            </span>
                            <span className="text-slate-500 font-bold text-sm">
                                Pregunta {currentQuestionIndex + 1} de {quizQuestions.length}
                            </span>
                        </div>
                        <button onClick={() => { if (confirm("¿Abandonar el examen contará como intento nulo. Seguro?")) setMode("IDLE") }} className="text-sm font-bold text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 px-4 py-2 rounded-xl transition-colors">
                            Abandonar Examen
                        </button>
                    </div>

                    <div className="mb-10 text-center">
                        <h3 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight tracking-tight">{q.question}</h3>
                    </div>

                    <div className="space-y-4 flex-1 max-w-2xl w-full mx-auto">
                        {q.options.map((opt: string, i: number) => {
                            let btnClass = "w-full text-left px-6 py-5 rounded-2xl border-2 transition-all font-semibold text-lg text-slate-700 ";

                            if (isAnswerRevealed) {
                                if (opt === q.correctAnswer) {
                                    btnClass += "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-md";
                                } else if (opt === selectedAnswer && opt !== q.correctAnswer) {
                                    btnClass += "bg-rose-50 border-rose-500 text-rose-800";
                                } else {
                                    btnClass += "border-slate-100 opacity-40";
                                }
                            } else {
                                if (opt === selectedAnswer) btnClass += "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-lg scale-[1.02] translate-x-2";
                                else btnClass += "border-slate-200 hover:border-indigo-300 hover:bg-slate-50 hover:translate-x-1";
                            }

                            return (
                                <button
                                    key={i}
                                    disabled={isAnswerRevealed}
                                    onClick={() => setSelectedAnswer(opt)}
                                    className={btnClass}
                                >
                                    <span className="mr-3 text-slate-400 font-bold opacity-50">{String.fromCharCode(65 + i)}.</span>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {isAnswerRevealed && (
                        <div className={"mt-8 p-6 rounded-2xl flex items-start gap-4 animate-in slide-in-from-bottom-4 " + (selectedAnswer === q.correctAnswer ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200")}>
                            <div className="text-4xl">{selectedAnswer === q.correctAnswer ? '✅' : '❌'}</div>
                            <div>
                                <p className={"font-black text-lg mb-1 " + (selectedAnswer === q.correctAnswer ? "text-emerald-800" : "text-rose-800")}>
                                    {selectedAnswer === q.correctAnswer ? '¡Respuesta Correcta!' : 'Respuesta Incorrecta'}
                                </p>
                                <p className="text-base text-slate-700 font-medium leading-relaxed">
                                    <strong className="text-slate-900">Zendi AI Coach:</strong> {q.explanation}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-10 pt-6 border-t border-slate-100 flex justify-between items-center">
                        <div className="flex gap-2">
                            {quizQuestions.map((_, idx) => (
                                <div key={idx} className={`h-2 rounded-full transition-all duration-300 ${idx === currentQuestionIndex ? 'w-8 bg-indigo-600' : idx < currentQuestionIndex ? 'w-2 bg-indigo-300' : 'w-2 bg-slate-200'}`} />
                            ))}
                        </div>

                        {!isAnswerRevealed ? (
                            <button
                                disabled={!selectedAnswer}
                                onClick={handleAnswerSubmit}
                                className="px-8 py-4 bg-indigo-600 text-white text-lg font-black rounded-2xl shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 disabled:opacity-50 disabled:shadow-none disabled:hover:scale-100 transition-all"
                            >
                                Comprobar Respuesta
                            </button>
                        ) : (
                            <button
                                onClick={handleNextQuestion}
                                className="px-8 py-4 bg-slate-900 text-white text-lg font-black rounded-2xl shadow-xl shadow-slate-900/30 hover:bg-black hover:scale-105 transition-all"
                            >
                                {currentQuestionIndex + 1 === quizQuestions.length ? "Finalizar Examen y Ver Resultados" : "Siguiente Pregunta →"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between h-full relative">
            {/* Status Tags On Image / Header */}
            {status === 'COMPLETED' && (
                <div className="absolute top-4 right-4 z-10 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                    ✅ Aprobado
                </div>
            )}
            
            {course.imageUrl ? (
                <div className="h-48 w-full relative overflow-hidden bg-slate-100">
                    <img src={course.imageUrl} alt={course.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 flex gap-2">
                        <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-white/20 flex items-center gap-1">⏱️ {course.durationMins} MINS</span>
                        <span className="bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg shadow-sm flex items-center gap-1">🚀 +{course.bonusCompliance} PTS</span>
                    </div>
                </div>
            ) : (
                <div className="h-40 w-full relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500"></div>
                    <span className="text-5xl drop-shadow-lg z-10 relative">🎓</span>
                    <div className="absolute bottom-4 left-4 flex gap-2 z-10">
                        <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-white/20 flex items-center gap-1">⏱️ {course.durationMins} MINS</span>
                        <span className="bg-black/30 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-black/20 flex items-center gap-1">🚀 +{course.bonusCompliance} PTS</span>
                    </div>
                </div>
            )}

            <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <span className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-slate-100">{course.category || "General"}</span>
                    {strikes > 0 && status !== 'COMPLETED' && strikes < 3 && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded flex items-center gap-1">⚠️ STRIKES: {strikes}/3</span>
                    )}
                </div>
                
                <h4 className="font-bold text-slate-800 text-lg leading-tight mb-2 mt-2 group-hover:text-indigo-600 transition-colors">{course.title}</h4>
                <p className="text-sm text-slate-500 mb-6 line-clamp-3 leading-relaxed">{course.description}</p>
                
                {/* Actions Footer */}
                <div className="mt-auto pt-4 border-t border-slate-50">
                    {status !== 'COMPLETED' ? (
                        <div className="flex flex-col gap-3 w-full">
                            {aiLoading ? (
                                <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 px-6 py-3.5 rounded-xl border border-indigo-100 w-full">
                                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                    Zendity AI Generando...
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={handleStartLearning}
                                        className="w-full px-6 py-3 rounded-xl text-sm font-bold transition-all bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:scale-[1.02] border border-indigo-100 flex justify-center items-center gap-2 active:scale-95"
                                    >
                                        <span>🧠</span> Estudiar Material
                                    </button>
                                    <button
                                        onClick={handleStartQuiz}
                                        className="w-full px-6 py-3 rounded-xl text-sm font-bold transition-all bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] text-white shadow-md shadow-indigo-200 flex justify-center items-center gap-2 active:scale-95"
                                    >
                                        <span>✍️</span> Iniciar Examen Oficial
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center w-full">
                            <button
                                onClick={() => generateZendityCertificate(user?.name || 'Usuario', course.title, new Date().toLocaleDateString())}
                                className="w-full px-6 py-3 rounded-xl text-sm font-bold transition-all bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-95"
                            >
                                <span>📜</span> Imprimir Certificado Zendity
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
