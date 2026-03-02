"use client";

import { useState } from "react";

export default function ZendityPreingresoPage() {
    const [step, setStep] = useState(1);
    const [isSigned, setIsSigned] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        avdScore: 0,
        diagnostics: '',
        diet: 'Regular'
    });

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-900 to-teal-700 bg-clip-text text-transparent">
                        Flujo de Preingreso & Ingreso
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Valoración clínica inicial, dieta y asignación de habitaciones (Cero Papel)
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-8">
                    {[
                        { num: 1, label: 'Datos Básicos' },
                        { num: 2, label: 'Valoración AVD' },
                        { num: 3, label: 'Nutrición y Dieta' },
                        { num: 4, label: 'Asignación' }
                    ].map((s) => (
                        <div key={s.num} className="flex flex-col items-center flex-1 relative">
                            {s.num !== 1 && <div className={`absolute top-4 -left-1/2 w-full h-1 ${step >= s.num ? 'bg-teal-700' : 'bg-gray-200'}`}></div>}
                            <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s.num ? 'bg-teal-700 text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>
                                {s.num}
                            </div>
                            <span className={`mt-3 text-xs font-semibold ${step >= s.num ? 'text-teal-900' : 'text-gray-400'}`}>{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Form Content */}
                <div className="mt-8">
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">1. Registro de Nuevo Residente</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-gray-50 border border-gray-300 text-gray-900 font-semibold text-lg rounded-lg focus:ring-teal-600 focus:border-teal-600 block w-full p-3 shadow-inner" placeholder="Ej. Roberto Martínez" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento</label>
                                    <input type="date" className="bg-gray-50 border border-gray-300 text-gray-900 font-semibold text-lg rounded-lg focus:ring-teal-600 focus:border-teal-600 block w-full p-3 shadow-inner" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnósticos Previos (Importación AI)</label>
                                    <textarea rows={3} value={formData.diagnostics} onChange={(e) => setFormData({ ...formData, diagnostics: e.target.value })} className="bg-gray-50 border border-gray-300 text-gray-900 font-semibold text-lg rounded-lg focus:ring-teal-600 focus:border-teal-600 block w-full p-3 shadow-inner" placeholder="Pegue la epicrisis aquí para extraer condiciones..."></textarea>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">2. Valoración de Actividades Vida Diaria (AVD)</h3>
                            <p className="text-sm text-gray-500 mb-4">Protocolo Zendity: Evalúe el nivel de dependencia para determinar la tarifa de cuidado.</p>

                            <div className="space-y-3">
                                {['Alimentación', 'Vestirse', 'Movilidad', 'Uso del Baño'].map((act, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
                                        <span className="font-medium text-gray-800">{act}</span>
                                        <select className="bg-white border text-gray-900 border-gray-300 font-semibold text-lg rounded-lg p-3 max-w-xs shadow-inner focus:ring-teal-600 focus:border-teal-600">
                                            <option value="0">Independiente (0 pts)</option>
                                            <option value="1">Asistencia Leve (1 pts)</option>
                                            <option value="2">Dependencia Total (2 pts)</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">3. Nutrición y Dieta</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div
                                    onClick={() => setFormData({ ...formData, diet: 'Regular' })}
                                    className={`p-5 border rounded-xl cursor-pointer transition-all ${formData.diet === 'Regular' ? 'border-teal-400 bg-teal-50 shadow-md ring-2 ring-teal-100' : 'border-gray-200 bg-white hover:border-teal-300'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl mb-3 shadow-sm ${formData.diet === 'Regular' ? 'bg-white' : 'bg-gray-100'}`}>🍲</div>
                                    <h4 className={`font-bold ${formData.diet === 'Regular' ? 'text-teal-900' : 'text-gray-900'}`}>Dieta Regular</h4>
                                    <p className={`text-xs mt-1 ${formData.diet === 'Regular' ? 'text-teal-800' : 'text-gray-500'}`}>Sin restricciones alimentarias detectadas en la importación AI.</p>
                                </div>
                                <div
                                    onClick={() => setFormData({ ...formData, diet: 'Blanda' })}
                                    className={`p-5 border rounded-xl cursor-pointer transition-all ${formData.diet === 'Blanda' ? 'border-teal-400 bg-teal-50 shadow-md ring-2 ring-teal-100' : 'border-gray-200 bg-white hover:border-teal-300'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl mb-3 shadow-sm ${formData.diet === 'Blanda' ? 'bg-white' : 'bg-gray-100'}`}>💧</div>
                                    <h4 className={`font-bold ${formData.diet === 'Blanda' ? 'text-teal-900' : 'text-gray-900'}`}>Dieta Blanda/Líquida</h4>
                                    <p className={`text-xs mt-1 ${formData.diet === 'Blanda' ? 'text-teal-800' : 'text-gray-500'}`}>Recomendado para casos de disfagia documentada.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 text-center">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 animate-bounce">
                                ✅
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Ingreso Listo para Aprobar</h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-6">El paciente está listo para ser ingresado. Se le asignará la habitación recomendada según nivel de AVD.</p>

                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-w-md mx-auto flex justify-between items-center mb-6">
                                <div className="text-left">
                                    <p className="text-xs text-gray-500 font-semibold uppercase">Habitación Asignada</p>
                                    <p className="text-lg font-bold text-teal-800">Pabellón B - Hab 104</p>
                                </div>
                                <button className="text-sm font-medium text-teal-700 hover:text-teal-900">Cambiar</button>
                            </div>

                            <div
                                onClick={() => setIsSigned(true)}
                                className={`w-full max-w-md mx-auto h-32 border-2 rounded-xl flex items-center justify-center flex-col cursor-crosshair transition-all ${isSigned ? 'bg-teal-50 border-teal-500' : 'bg-gray-50 border-dashed border-gray-300 hover:bg-gray-100'}`}
                            >
                                {isSigned ? (
                                    <>
                                        <span className="text-teal-600 text-2xl mb-1">🖋️</span>
                                        <p className="text-teal-800 text-sm font-bold">Firma Digital Estampada Correctamente</p>
                                        <p className="text-teal-600/70 text-xs">ID: SIG-849204-TR-AB</p>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-gray-400 mb-2 text-2xl">✍️</span>
                                        <p className="text-gray-500 text-sm font-medium">Toque aquí para estampar firma digital del Trabajador Social</p>
                                    </>
                                )}
                            </div>

                            {/* Success Alert */}
                            {isSuccess && (
                                <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg text-sm font-medium animate-in fade-in zoom-in-95">
                                    ¡Residente ingresado exitosamente en la base de datos de Zendity! Redirigiendo...
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between">
                    <button
                        disabled={step === 1 || isSubmitting}
                        onClick={() => setStep(step - 1)}
                        className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${step === 1 || isSubmitting ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Atrás
                    </button>

                    <button
                        disabled={isSubmitting || (step === 4 && !isSigned)}
                        onClick={async () => {
                            if (step < 4) {
                                setStep(step + 1);
                            } else {
                                setIsSubmitting(true);
                                try {
                                    await fetch('/api/preingreso', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            name: formData.name || 'Residente Nuevo',
                                            avdScore: formData.avdScore,
                                            diagnostics: formData.diagnostics,
                                            diet: formData.diet,
                                            hqId: 'org-green-forest-19292472'
                                        })
                                    });
                                    setIsSuccess(true);
                                    setTimeout(() => {
                                        setStep(1);
                                        setIsSuccess(false);
                                        setIsSigned(false);
                                        setFormData({ name: '', avdScore: 0, diagnostics: '', diet: 'Regular' });
                                    }, 3000);
                                } catch (e) {
                                    console.error(e);
                                    alert("Error al procesar el ingreso.");
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }
                        }}
                        className={`font-medium rounded-lg text-sm px-8 py-2.5 transition-colors shadow-sm ${isSubmitting || (step === 4 && !isSigned) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-teal-700 hover:bg-teal-800 text-white'}`}
                    >
                        {isSubmitting ? 'Procesando...' : (step === 4 ? 'Confirmar e Ingresar' : 'Siguiente')}
                    </button>
                </div>
            </div>
        </div>
    );
}
