"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  UserPlus,
  Stethoscope,
  Heart,
  Monitor,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Trophy,
} from "lucide-react";
import { useActiveHq } from "@/contexts/ActiveHqContext";

interface Step {
  id: string;
  label: string;
  href?: string;
}

interface Phase {
  id: string;
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: Step[];
  actionLabel?: string;
  actionHref?: string;
}

const PHASES: Phase[] = [
  {
    id: "fase-1",
    number: 1,
    title: "Configuración de tu Sede",
    description: "Personaliza la identidad y datos de contacto de tu hogar.",
    icon: <Building2 className="w-5 h-5" />,
    steps: [
      { id: "sede-logo", label: "Agregar nombre y logo de tu hogar", href: "/corporate/sedes" },
      { id: "sede-telefono", label: "Verificar teléfono y dirección" },
      { id: "sede-admin", label: "Invitar a tu administrador(a)" },
    ],
    actionLabel: "Ir a Sedes",
    actionHref: "/corporate/sedes",
  },
  {
    id: "fase-2",
    number: 2,
    title: "Registrar tu Equipo",
    description: "Crea las cuentas del personal y publica el primer horario.",
    icon: <Users className="w-5 h-5" />,
    steps: [
      { id: "equipo-enfermeras", label: "Crear cuentas para enfermeras", href: "/hr/staff" },
      { id: "equipo-cuidadores", label: "Crear cuentas para cuidadores" },
      { id: "equipo-cocina", label: "Crear cuentas para cocina y mantenimiento" },
      { id: "equipo-horario", label: "Publicar el primer horario de trabajo", href: "/hr/schedule" },
    ],
    actionLabel: "Ir a Personal",
    actionHref: "/hr/staff",
  },
  {
    id: "fase-3",
    number: 3,
    title: "Admitir Residentes",
    description: "Registra a los primeros residentes y carga su historial médico.",
    icon: <UserPlus className="w-5 h-5" />,
    steps: [
      { id: "residentes-formulario", label: "Completar el formulario de admisión del primer residente", href: "/corporate/patients/intake" },
      { id: "residentes-medicamentos", label: "Cargar medicamentos activos" },
      { id: "residentes-tarjeta", label: "Generar Tarjeta de Emergencia para cada residente" },
    ],
    actionLabel: "Admitir Residente",
    actionHref: "/corporate/patients/intake",
  },
  {
    id: "fase-4",
    number: 4,
    title: "Activar Módulos Clínicos",
    description: "Configura el eMAR digital y el dashboard de supervisión.",
    icon: <Stethoscope className="w-5 h-5" />,
    steps: [
      { id: "clinicos-emar", label: "Acceder al eMAR digital en tablets", href: "/care" },
      { id: "clinicos-cierre", label: "Configurar el cierre de turno diario" },
      { id: "clinicos-triage", label: "Revisar el dashboard de Triage", href: "/care/supervisor" },
    ],
    actionLabel: "Ir al eMAR",
    actionHref: "/care",
  },
  {
    id: "fase-5",
    number: 5,
    title: "Conectar con Familias",
    description: "Invita a las familias y activa el portal de comunicación.",
    icon: <Heart className="w-5 h-5" />,
    steps: [
      { id: "familias-invitar", label: "Invitar a la primera familia desde el perfil del residente" },
      { id: "familias-portal", label: "Verificar que el portal familiar funciona", href: "/family" },
      { id: "familias-mensaje", label: "Enviar el primer mensaje grupal", href: "/corporate/family-broadcast" },
    ],
    actionLabel: "Portal Familiar",
    actionHref: "/family",
  },
  {
    id: "fase-6",
    number: 6,
    title: "Kiosco de Recepción",
    description: "Instala y prueba el kiosco de registro de visitas.",
    icon: <Monitor className="w-5 h-5" />,
    steps: [
      { id: "kiosco-configurar", label: "Configurar el kiosco en una tablet", href: "/corporate/reception-setup" },
      { id: "kiosco-tablet", label: "Colocar la tablet en la entrada" },
      { id: "kiosco-probar", label: "Probar el registro de visita" },
    ],
    actionLabel: "Configurar Kiosco",
    actionHref: "/corporate/reception-setup",
  },
];

const TOTAL_STEPS = PHASES.reduce((acc, p) => acc + p.steps.length, 0);

export default function OnboardingPage() {
  const { activeHqId } = useActiveHq();
  const storageKey = `zendity-onboarding-${activeHqId}`;

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "fase-1": true,
  });
  const [hydrated, setHydrated] = useState(false);

  // Cargar estado desde localStorage
  useEffect(() => {
    if (!activeHqId || activeHqId === "ALL") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setChecked(JSON.parse(raw));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [activeHqId, storageKey]);

  // Persistir cambios
  useEffect(() => {
    if (!hydrated || !activeHqId || activeHqId === "ALL") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked, hydrated, activeHqId, storageKey]);

  const completedSteps = Object.values(checked).filter(Boolean).length;
  const progressPercent = TOTAL_STEPS > 0 ? Math.round((completedSteps / TOTAL_STEPS) * 100) : 0;
  const allComplete = completedSteps === TOTAL_STEPS;

  function toggleCheck(stepId: string) {
    setChecked((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  }

  function toggleExpand(phaseId: string) {
    setExpanded((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  }

  function isPhaseComplete(phase: Phase) {
    return phase.steps.every((s) => checked[s.id]);
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-slate-800">Bienvenido a Zéndity</h1>
          <p className="text-slate-500 text-base">Guía de configuración inicial</p>
        </div>

        {/* Progress bar */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Progreso general</span>
            <span className="text-sm text-slate-500">
              {completedSteps} de {TOTAL_STEPS} pasos completados
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-teal-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-teal-600">{progressPercent}% completado</p>
        </div>

        {/* Fases */}
        <div className="space-y-4">
          {PHASES.map((phase) => {
            const phaseComplete = isPhaseComplete(phase);
            const isOpen = !!expanded[phase.id];

            return (
              <div
                key={phase.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Fase header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(phase.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
                >
                  {/* Número de fase */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
                    {phaseComplete ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      phase.number
                    )}
                  </div>

                  {/* Icono + título */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-teal-600">{phase.icon}</span>
                      <span className="font-semibold text-slate-800">{phase.title}</span>
                      {phaseComplete && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                          <Check className="w-3 h-3" />
                          Completado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 truncate">{phase.description}</p>
                  </div>

                  {/* Chevron */}
                  <div className="flex-shrink-0 text-slate-400">
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {/* Fase body */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
                    {/* Lista de pasos */}
                    <ul className="space-y-3">
                      {phase.steps.map((step) => {
                        const isDone = !!checked[step.id];
                        return (
                          <li key={step.id} className="flex items-start gap-3">
                            {/* Checkbox personalizado */}
                            <button
                              type="button"
                              onClick={() => toggleCheck(step.id)}
                              className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                isDone
                                  ? "bg-teal-600 border-teal-600"
                                  : "border-slate-300 bg-white hover:border-teal-400"
                              }`}
                              aria-checked={isDone}
                              role="checkbox"
                            >
                              {isDone && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </button>

                            {/* Label + link opcional */}
                            <div className="flex items-center gap-2 flex-1 flex-wrap">
                              <span
                                className={`text-sm ${
                                  isDone ? "line-through text-slate-400" : "text-slate-700"
                                }`}
                              >
                                {step.label}
                              </span>
                              {step.href && (
                                <Link
                                  href={step.href}
                                  className="text-teal-600 hover:text-teal-700 flex-shrink-0"
                                  title={`Ir a ${step.label}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Botón de acción */}
                    {phase.actionHref && phase.actionLabel && (
                      <div className="pt-2">
                        <Link
                          href={phase.actionHref}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
                        >
                          {phase.actionLabel}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tarjeta de felicitaciones */}
        {allComplete && (
          <div className="bg-white border border-teal-200 rounded-2xl shadow-sm p-8 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-800">
                ¡Felicitaciones! Tu sede está lista para operar con Zéndity
              </h2>
              <p className="text-slate-500 text-sm">
                Has completado todos los pasos de configuración. El equipo puede empezar a usar la plataforma.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium text-amber-600">
                {TOTAL_STEPS} pasos completados
              </span>
            </div>
            <Link
              href="/corporate"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
            >
              Ir al Dashboard Global
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
