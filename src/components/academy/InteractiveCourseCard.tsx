import React, { useState, useEffect } from "react";
import Object from "jspdf";
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
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50 transition-all group-hover:scale-110"></div>

            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1">⏱️ {course.durationMins} MINS</span>
                        <span className="text-xs text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded flex items-center gap-1">🚀 +{course.bonusCompliance} PTS</span>
                        {status === 'COMPLETED' && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">✅ APROBADO</span>}
                        {strikes > 0 && status !== 'COMPLETED' && strikes < 3 && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded flex items-center gap-1">⚠️ STRIKES: {strikes}/3</span>}
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 tracking-tight">{course.title}</h4>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">{course.description}</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-end items-center gap-3 pt-6 mt-auto">
                {status !== 'COMPLETED' ? (
                    <div className="flex gap-2 w-full md:w-auto">
                        {aiLoading ? (
                            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 px-6 py-2.5 rounded-xl border border-indigo-100 w-full md:w-auto justify-center">
                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                Zendity AI Generando...
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={handleStartLearning}
                                    className="w-full md:w-auto px-6 py-2.5 rounded-xl text-sm font-bold transition-all bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex justify-center items-center gap-2"
                                >
                                    <span>🧠</span> Estudiar Material
                                </button>
                                <button
                                    onClick={handleStartQuiz}
                                    className="w-full md:w-auto px-6 py-2.5 rounded-xl text-sm font-bold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 flex justify-center items-center gap-2"
                                >
                                    <span>✍️</span> Iniciar Examen Oficial
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-3 w-full">
                        <button
                            onClick={() => generateZendityCertificate(user?.name || 'Usuario', course.title, new Date().toLocaleDateString())}
                            className="flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md shadow-green-200 border-0 flex justify-center items-center gap-2"
                        >
                            <span>📜</span> Imprimir Certificado Zendity
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
