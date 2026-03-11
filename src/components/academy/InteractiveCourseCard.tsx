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
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 min-h-[300px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tarjeta {activeCardIndex + 1} de {flashcards.length}</span>
                    <button onClick={() => setMode("IDLE")} className="text-sm font-bold text-slate-400 hover:text-slate-600">✕ Cerrar</button>
                </div>
                <div className="flex-1 flex flex-col justify-center items-center text-center px-4 md:px-12 py-8 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-blue-100">
                    <h3 className="text-2xl font-black text-slate-800 mb-4">{card.title}</h3>
                    <p className="text-lg text-slate-600 leading-relaxed font-medium">{card.content}</p>
                </div>
                <div className="flex justify-between items-center mt-6">
                    <button
                        onClick={() => setActiveCardIndex(Math.max(0, activeCardIndex - 1))}
                        disabled={activeCardIndex === 0}
                        className="px-4 py-2 text-sm font-bold text-slate-500 disabled:opacity-30 hover:text-indigo-600"
                    >
                        ← Anterior
                    </button>
                    {activeCardIndex + 1 === flashcards.length ? (
                        <button onClick={() => setMode("IDLE")} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700">Entendido 🎓</button>
                    ) : (
                        <button onClick={() => setActiveCardIndex(activeCardIndex + 1)} className="px-6 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-200">Siguiente →</button>
                    )}
                </div>
            </div>
        );
    }

    if (mode === "QUIZ") {
        const q = quizQuestions[currentQuestionIndex];
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-indigo-100 min-h-[300px] flex flex-col animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Examen Oficial • Pregunta {currentQuestionIndex + 1} de {quizQuestions.length}</span>
                    <button onClick={() => { if (confirm("¿Abandonar el examen contará como intento nulo. Seguro?")) setMode("IDLE") }} className="text-sm font-bold text-slate-400 hover:text-red-500">Abandonar</button>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-6">{q.question}</h3>

                <div className="space-y-3 flex-1">
                    {q.options.map((opt: string, i: number) => {
                        let btnClass = "w-full text-left px-5 py-4 rounded-xl border-2 transition-all font-medium text-slate-700 ";

                        if (isAnswerRevealed) {
                            if (opt === q.correctAnswer) {
                                btnClass += "bg-green-50 border-green-500 text-green-800";
                            } else if (opt === selectedAnswer && opt !== q.correctAnswer) {
                                btnClass += "bg-red-50 border-red-500 text-red-800";
                            } else {
                                btnClass += "border-slate-100 opacity-50";
                            }
                        } else {
                            if (opt === selectedAnswer) btnClass += "border-indigo-600 bg-indigo-50 shadow-sm";
                            else btnClass += "border-slate-200 hover:border-indigo-300 hover:bg-slate-50";
                        }

                        return (
                            <button
                                key={i}
                                disabled={isAnswerRevealed}
                                onClick={() => setSelectedAnswer(opt)}
                                className={btnClass}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>

                {isAnswerRevealed && (
                    <div className={"mt-6 p-4 rounded-xl flex items-start gap-3 " + (selectedAnswer === q.correctAnswer ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900")}>
                        <span className="text-2xl">{selectedAnswer === q.correctAnswer ? '✅' : '❌'}</span>
                        <div>
                            <p className="font-bold mb-1">Zendi AI Coach:</p>
                            <p className="text-sm opacity-90">{q.explanation}</p>
                        </div>
                    </div>
                )}

                <div className="mt-8 flex justify-end">
                    {!isAnswerRevealed ? (
                        <button
                            disabled={!selectedAnswer}
                            onClick={handleAnswerSubmit}
                            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
                        >
                            Comprobar Respuesta
                        </button>
                    ) : (
                        <button
                            onClick={handleNextQuestion}
                            className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-black transition-all"
                        >
                            {currentQuestionIndex + 1 === quizQuestions.length ? "Finalizar Examen y Ver Resultados" : "Siguiente Pregunta →"}
                        </button>
                    )}
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
                    <>
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
                    </>
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
