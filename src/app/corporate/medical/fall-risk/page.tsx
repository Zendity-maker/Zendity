import { prisma } from '@/lib/prisma';
import React from 'react';
import {  FallRiskLevel, IncidentSeverity } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';



// FASE 24: Tablero B2B de Riesgo de Caídas e Incidentes
export default async function FallRiskDashboard() {
    // 1. Obtener Residentes de la Sede Activa y Agrupar por Fall Risk Level
    // Mock Sede B2B
    const hqId = "0f5ed479-05db-442c-a226-eb6f0edc4069";

    // Traer a todos los residentes y su última evaluación de caída
    const patients = await prisma.patient.findMany({
        where: { headquartersId: hqId },
        include: {
            fallRiskAssessments: {
                orderBy: { evaluatedAt: 'desc' },
                take: 1
            }
        }
    });

    // 2. Traer los Últimos 5 Incidentes (Caídas Reales)
    const recentIncidents = await prisma.fallIncident.findMany({
        where: {
            patient: { headquartersId: hqId }
        },
        include: { patient: true },
        orderBy: { incidentDate: 'desc' },
        take: 5
    });

    // Clasificación Rápida
    const highRisk = patients.filter(p => p.fallRiskAssessments[0]?.riskLevel === FallRiskLevel.HIGH);
    const modRisk = patients.filter(p => p.fallRiskAssessments[0]?.riskLevel === FallRiskLevel.MODERATE);
    const lowRisk = patients.filter(p => p.fallRiskAssessments[0]?.riskLevel === FallRiskLevel.LOW);
    const unassessed = patients.filter(p => p.fallRiskAssessments.length === 0);

    const now = new Date();

    return (
        <div className="p-8 pb-32">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Prevención de Caídas Incidentales</h1>
                    <p className="text-gray-500 mt-2 text-sm">Escala Paramétrica Morse & Registro de Riesgo</p>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Lado Izquierdo: Cuadrantes de Riesgo (3 Columnas) */}
                <div className="xl:col-span-3 space-y-8">

                    {/* Alto Riesgo */}
                    <section>
                        <h2 className="text-lg font-semibold text-rose-700 flex items-center mb-4">
                            <span className="w-3 h-3 rounded-full bg-rose-500 mr-2 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></span>
                            Alto Riesgo ({highRisk.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {highRisk.map(patient => (
                                <PatientRiskCard key={patient.id} patient={patient} level="HIGH" now={now} />
                            ))}
                            {highRisk.length === 0 && <p className="text-sm text-gray-400 italic">No hay residentes en alto riesgo.</p>}
                        </div>
                    </section>

                    {/* Riesgo Moderado */}
                    <section>
                        <h2 className="text-lg font-semibold text-amber-700 flex items-center mb-4">
                            <span className="w-3 h-3 rounded-full bg-amber-500 mr-2 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>
                            Riesgo Moderado ({modRisk.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {modRisk.map(patient => (
                                <PatientRiskCard key={patient.id} patient={patient} level="MODERATE" now={now} />
                            ))}
                        </div>
                    </section>

                    {/* Sin Evaluar */}
                    {unassessed.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-gray-700 flex items-center mb-4">
                                <span className="w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
                                Pendientes de Evaluación Crítica ({unassessed.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {unassessed.map(patient => (
                                    <PatientRiskCard key={patient.id} patient={patient} level="UNASSESSED" now={now} />
                                ))}
                            </div>
                        </section>
                    )}

                </div>

                {/* Lado Derecho: Incident Feed (1 Columna) */}
                <aside className="xl:col-span-1 border-l pl-8 border-gray-200">
                    <h3 className="text-base font-semibold text-gray-900 mb-6 flex items-center">
                        <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Incidentes Recientes (72 Hrs)
                    </h3>

                    {recentIncidents.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-sm text-gray-500">Cero Caídas Reportadas</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentIncidents.map(incident => (
                                <IncidentFeedCard key={incident.id} incident={incident} />
                            ))}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

// ========================
// SUB-COMPONENTES UI
// ========================

function PatientRiskCard({ patient, level, now }: { patient: any, level: string, now: Date }) {
    const lastEval = patient.fallRiskAssessments?.[0];

    // Determinar Colores de la Tarjeta según Nivel
    let borderClass = "border-gray-200 hover:border-gray-300";
    let bgPulse = "";

    if (level === 'HIGH') {
        borderClass = "border-rose-200 hover:border-rose-400 bg-rose-50/30";
        bgPulse = "bg-rose-100 text-rose-800";
    } else if (level === 'MODERATE') {
        borderClass = "border-amber-200 hover:border-amber-400 bg-amber-50/30";
        bgPulse = "bg-amber-100 text-amber-800";
    }

    // Calcular Vencimiento (Si nextReviewAt ya pasó)
    const isOverdue = lastEval?.nextReviewAt && new Date(lastEval.nextReviewAt) < now;

    return (
        <div className={`p-4 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md bg-white ${borderClass}`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${bgPulse || 'bg-gray-100 text-gray-600'}`}>
                        {patient.name.charAt(0)}
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900">{patient.name}</h4>
                        <p className="text-xs text-gray-500">Cuarto {patient.roomNumber || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {level === 'UNASSESSED' ? (
                <div className="mt-4 p-2 bg-gray-50 rounded-lg border border-dashed text-center">
                    <p className="text-xs text-gray-500">Falta Escala Morse</p>
                </div>
            ) : (
                <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Evaluado:</span>
                        <span className="font-medium text-gray-700">
                            {lastEval ? formatDistanceToNow(new Date(lastEval.evaluatedAt), { addSuffix: true, locale: es }) : 'N/A'}
                        </span>
                    </div>

                    {/* OVERDUE BADGE */}
                    {isOverdue && (
                        <div className="mt-2 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 py-1 px-2 rounded-md text-center animate-pulse">
                            ¡Re-Evaluación Vencida!
                        </div>
                    )}
                </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100">
                <Link
                    href={`/corporate/medical/patients/${patient.id}?tab=falls`}
                    className="w-full flex items-center justify-center space-x-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                    <span>Abrir Ficha Clínica</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}

function IncidentFeedCard({ incident }: { incident: any }) {
    const timeAgo = formatDistanceToNow(new Date(incident.incidentDate), { addSuffix: true, locale: es });

    let sevBadge = "bg-gray-100 text-gray-700";
    if (incident.severity === 'FATAL' || incident.severity === 'SEVERE') sevBadge = "bg-red-100 text-red-700";
    if (incident.severity === 'MILD') sevBadge = "bg-orange-100 text-orange-700";

    return (
        <div className="p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors cursor-pointer group">
            <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-gray-900">{incident.patient.name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sevBadge}`}>
                    {incident.severity}
                </span>
            </div>

            <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-2">
                <span className="font-medium">Locación: </span>{incident.location}. {incident.notes}
            </p>

            <p className="mt-3 text-[10px] text-gray-400 group-hover:text-indigo-500 transition-colors">
                Hace {timeAgo}
            </p>
        </div>
    );
}
