import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const HQ_ID = process.env.SEED_HQ_ID || "b2ac0700-f937-4085-9595-dcf81a2e5e30";

const roleCourses = [
  {
    title: "Manual del Director — Operación Completa en Zendity",
    description: "Domina el uso completo de Zendity como Director: rutina diaria, gestión clínica, admisiones, personal, supervisión remota y respuesta a escalados.",
    category: "Formación Directiva",
    targetRole: "DIRECTOR",
    durationMins: 40,
    bonusCompliance: 20,
    imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80",
    content: `### El Director como eje central de Zendity

Eres el único rol con visibilidad completa del sistema. Tu dashboard en /corporate consolida en tiempo real el cumplimiento del eMAR, incidentes activos, desempeño del personal y métricas de la sede.

---

### Tu rutina diaria en Zendity

**7:00 AM — Revisión matutina**
Abre el Dashboard Gerencial (/corporate). Verifica incidentes críticos del turno nocturno, el Digest de Zendi AI y los MISSED del eMAR sin justificar.

**9:00 AM — Operaciones del día**
Revisa el calendario, aprueba cotizaciones de mantenimiento, sigue leads del CRM, revisa tickets HIGH o CRITICAL sin resolver.

**Mediodía — Gestión de personal**
Revisa evaluaciones de desempeño en /hr, verifica Academy del personal, responde alertas de scores bajos.

**6:00 PM — Cierre del día**
Revisa el resumen del supervisor saliente, verifica incidentes sin documentar, revisa el Wall of Care.

---

### Activación del eMAR de nuevos residentes

Los medicamentos del Intake quedan en estado DORMANT hasta que tú los actives. Antes de activar:

1. Accede al perfil del nuevo residente en /corporate/medical/patients
2. Revisa cada medicamento contra el recetario físico firmado por el médico
3. Confirma que las alergias son correctas
4. Activa el eMAR — los medicamentos pasan a ACTIVE
5. Notifica verbalmente al supervisor del primer turno

**Nunca actives sin verificar el recetario físico.**

---

### Escalas de desempeño del personal

| Score | Significado | Tu acción |
|---|---|---|
| 90–100 | Excelencia | Reconocimiento público |
| 85–89 | Sólido | Seguimiento rutinario |
| 75–84 | Área de mejora | Academy automático asignado |
| 60–74 | Riesgo operativo | Conversación directa + plan de mejora |
| < 60 | Intervención urgente | Revisión formal + posible acción disciplinaria |

---

### Supervisión remota

Desde cualquier dispositivo puedes: ver el dashboard en tiempo real, aprobar cotizaciones, revisar el log de auditoría del eMAR, escalar tickets, recibir el Digest de Zendi AI de cada cambio de turno.

**Alertas automáticas que recibes:** caída ALTO/CRÍTICO, hospitalización de emergencia, Override Forzado, ticket CRITICAL sin resolver en 2 horas, empleado con score < 75.

---

### Rutas que más usarás

/corporate — Dashboard gerencial
/corporate/patients/intake — Admisión de residentes
/corporate/crm — Pipeline de admisiones
/corporate/medical/emar — Auditoría del eMAR
/hr/staff — Gestión de usuarios
/hr — Desempeño del personal
/maintenance — Planta física

---

### Dinámica de Reflexión Práctica

**Escenario:** Son las 7:15am. El Dashboard muestra: 3 MISSED del turno nocturno sin justificar, un Override Forzado en el cierre del cuidador de las 10pm, y un ticket HIGH de mantenimiento abierto desde las 8pm de ayer sobre un aire acondicionado dañado en el ala de residentes RED.

Describe el orden exacto en que atiendes estos tres elementos y qué acción específica tomas con cada uno.`
  },
  {
    title: "Manual del Administrador — Gestión Operativa en Zendity",
    description: "Aprende a gestionar el pipeline de admisiones, usuarios, calendario corporativo y operaciones diarias como Administrador delegado del Director.",
    category: "Formación Administrativa",
    targetRole: "ADMIN",
    durationMins: 30,
    bonusCompliance: 15,
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
    content: `### El Administrador como brazo ejecutivo del Director

El Director decide — el Administrador ejecuta. Tienes acceso casi idéntico al Director dentro del área corporativa, pero actúas bajo su autorización en decisiones estratégicas y clínicas.

---

### Tu responsabilidad principal: Las admisiones

Eres el gestor principal del pipeline de admisiones en /corporate/crm.

**Flujo completo:**
1. Registrar el lead de la familia con datos básicos
2. Dar seguimiento activo — llamadas, visitas, documentos
3. Completar el Intake Maestro (/corporate/patients/intake)
4. Generar documentos de admisión desde /corporate/intake
5. Notificar al Director que el expediente está listo para activación clínica
6. Coordinar con el supervisor del primer turno

**Nunca actives el eMAR tú solo — eso es responsabilidad del Director.**

---

### Gestión de usuarios

Solo tú y el Director pueden crear y desactivar usuarios.

**Crear usuario:** /hr/staff → Nuevo Empleado → completar datos → el sistema genera PIN automáticamente. Entregarlo de forma segura.

**Dar de baja:** cambiar estado a INACTIVO el mismo día de la salida. Un usuario activo sin empleado es un riesgo de seguridad.

---

### Calendario corporativo

Tipos de eventos que gestionas:
- Visitas médicas de residentes
- Llamadas Familiares (incluir nombre, relación y teléfono del familiar)
- Inspecciones de mantenimiento
- Reuniones de equipo

Un evento de Llamada Familiar sin número de teléfono deja al cuidador sin información para actuar.

---

### Qué escala siempre al Director

- Activación del eMAR de nuevos residentes
- Incidentes clínicos ALTO o CRÍTICO
- Sanciones disciplinarias al personal
- Cotizaciones que superen el umbral de gasto autónomo
- Cualquier situación con riesgo para un residente

---

### ZendiAssist para tus comunicaciones

- **CORPORATE_COMMS_POLISH** — emails institucionales
- **SUPERVISOR_MEMO** — comunicaciones formales al personal
- **FAMILY_MESSAGE** — mensajes a familias de residentes

---

### Dinámica de Reflexión Práctica

**Escenario:** Una familia lleva 3 semanas en proceso de admisión. Hoy confirmaron que quieren proceder. Tienes el contrato firmado y la historia clínica, pero el recetario de medicamentos que entregaron es una lista escrita a mano por la hija — no está firmado por el médico.

¿Puedes completar el Intake y pedir al Director que active el eMAR con esa lista? ¿Qué pasos debes seguir antes de proceder?`
  },
  {
    title: "Manual del Supervisor — Control del Turno en Zendity",
    description: "Domina el dashboard de supervisión, la gestión del eMAR en tiempo real, el triage de incidentes, los handovers y la comunicación con el equipo de piso.",
    category: "Formación de Supervisión",
    targetRole: "SUPERVISOR",
    durationMins: 30,
    bonusCompliance: 15,
    imageUrl: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80",
    content: `### El Supervisor como puente entre dirección y piso

Tu dashboard en /care/supervisor es el centro de comando del turno. Te muestra en tiempo real: sesiones activas, MISSED del eMAR, tickets de triage, handovers pendientes y estado general de la sede.

---

### Tu rutina en tres momentos

**Al inicio del turno:**
1. Abrir el Dashboard de Supervisión
2. Escuchar el Zendi Morning Briefing
3. Revisar sesiones activas — confirmar que el equipo está correcto
4. Revisar MISSED sin justificar del turno anterior
5. Revisar tickets HIGH o CRITICAL abiertos
6. Presidir el handover presencial si aplica

**Durante el turno:**
- Monitorear el dashboard cada 60-90 minutos
- Responder escalados del equipo de piso
- Validar handovers recibidos
- Registrar feedback de cocina después de cada comida

**Al cierre del turno:**
- Verificar que todos completaron su cierre
- Resolver handovers pendientes
- Ejecutar cierre administrativo de sesiones zombi si las hay

---

### Respuesta ante MISSED del eMAR

Un MISSED no es automáticamente un error — puede tener razón válida. Tu responsabilidad es asegurarte de que quede documentado correctamente.

1. Contactar al cuidador responsable
2. Si puede administrarse fuera de ventana: ADMINISTERED con nota
3. Si no puede administrarse: OMITTED con justificación
4. Si el patrón es recurrente: escalar al Director con evidencia

---

### Triage — Tiempos de respuesta

| Prioridad | Tu tiempo máximo |
|---|---|
| CRITICAL | Respuesta inmediata — notificar al Director |
| HIGH | Resolver o escalar en menos de 2 horas |
| MEDIUM | Resolver antes del cierre del turno |
| LOW | Programar resolución en la semana |

---

### Sesiones zombi — Cierre administrativo

Si un cuidador salió sin cerrar y la sesión lleva más de 12 horas activa:
1. Revisar el eMAR — ¿hay MISSED pendientes?
2. Resolver o documentar los pendientes
3. Ejecutar el cierre administrativo desde tu dashboard
4. Notificar al Director y al cuidador

---

### El Supervisor notifica — el Director sanciona

Puedes documentar y comunicar situaciones de desempeño. Las sanciones formales son decisión exclusiva del Director. Tú presentas la evidencia — él decide la acción.

---

### Dinámica de Reflexión Práctica

**Escenario:** Son las 3pm. El dashboard muestra que el cuidador del ala norte tiene 2 MISSED del mediodía sin justificar, y hay un ticket HIGH de triage sobre una residente que se negó a comer en el almuerzo y está "más callada de lo normal" según la nota.

¿Cuál de los dos atiendes primero y por qué? Describe las acciones específicas que tomas con cada uno.`
  },
  {
    title: "Manual del Cuidador — Tu Guía Completa en Zendity",
    description: "Todo lo que necesitas saber para operar Zendity en el piso: eMAR, Daily Log, cierre de turno, grupos de color, Zendi AI y handover.",
    category: "Formación de Piso",
    targetRole: "CAREGIVER",
    durationMins: 35,
    bonusCompliance: 15,
    imageUrl: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&q=80",
    content: `### Zendity está diseñado para ti

Todas las pantallas son táctiles, optimizadas para tablet, y diseñadas para que la documentación sea rápida y no interrumpa el cuidado. El sistema te respalda — tú cuidas al residente.

---

### Tus rutas principales

- **/care** — Tu punto de partida en cada turno
- **/care/emar** — Donde registras cada medicamento
- **/care/calendar** — Eventos de tu turno
- **/wall** — Estado visual de todos los residentes (solo lectura)
- **/academy** — Tus cursos de certificación

---

### Al iniciar el turno

1. Hacer login y escuchar el Prólogo del Turno de Zendi AI
2. Leer el handover del turno anterior completo
3. Confirmar la recepción del handover en Zendity
4. Identificar residentes con novedades del turno anterior

**No entres al piso sin confirmar el handover.**

---

### Los 5 Correctos — Antes de cada medicamento

1. **Residente correcto** — confirmar nombre y habitación
2. **Medicamento correcto** — verificar nombre y presentación
3. **Dosis correcta** — verificar cantidad en el eMAR
4. **Vía correcta** — oral, tópica, sublingual
5. **Hora correcta** — dentro de la ventana de 30 minutos

---

### Tu grupo de color

Eres responsable de los residentes de tu color asignado:
- **RED** — Alta complejidad, monitoreo frecuente, documentación detallada
- **YELLOW** — Complejidad media, atentos a cambios
- **GREEN** — Estable, cuidado rutinario
- **BLUE** — En observación, documentar cualquier cambio

---

### El Daily Log

Durante el turno documenta el estado de cada residente: estado general, ingesta alimentaria, movilidad, estado emocional, cambios respecto al día anterior.

Usa el botón ✦ de Zendi AI — transforma tus notas en terminología clínica en segundos.

---

### Cuando el residente rechaza el medicamento

1. Intentar una segunda vez con calma
2. Si persiste — **no forzar nunca**
3. Registrar como RECHAZADO con nota detallada
4. Notificar al supervisor inmediatamente

---

### Cierre del turno

1. Resolver todos los MISSED o justificarlos
2. Completar el Daily Log de todos tus residentes
3. Redactar notas de handover con ZendiAssist
4. Firmar digitalmente en el pad de tu tablet
5. Confirmar el cierre

**El turno no termina hasta que Zendity lo confirme.**

---

### Dinámica de Reflexión Práctica

**Escenario:** Llevas 6 horas de turno. Quedan 2 horas para el cierre. Revisas el eMAR y ves que la dosis de las 2pm del residente de habitación 9 aparece como MISSED — estabas atendiendo una emergencia en otra habitación y se te fue la ventana. El residente está bien, despierto y disponible ahora.

¿Qué estado usas para registrar esta situación? ¿Puedes administrar la dosis ahora? ¿Qué incluye la nota?`
  },
  {
    title: "Manual de la Enfermera — Autoridad Clínica en Zendity",
    description: "Domina tu rol clínico en Zendity: gestión del eMAR avanzado, escalas de riesgo, handovers clínicos, UPPs y respuesta ante emergencias médicas.",
    category: "Formación Clínica",
    targetRole: "NURSE",
    durationMins: 35,
    bonusCompliance: 15,
    imageUrl: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&q=80",
    content: `### La enfermera como autoridad clínica del sistema

Tienes acceso al perfil clínico completo de todos los residentes, puedes administrar medicamentos en cualquier caso, validas las escalas de riesgo y gestionas los handovers clínicos formales.

---

### Tus rutas principales

- **/nursing/handovers** — Handovers clínicos entre turnos
- **/care/supervisor** — Vista clínica del estado del eMAR
- **/corporate/medical/patients** — Directorio completo de residentes
- **/corporate/medical/upp-dashboard** — Monitor de UPPs
- **/corporate/medical/fall-risk** — Escalas de riesgo
- **/care/emar** — Administración directa cuando necesario

---

### Medicamentos HELD — Tu responsabilidad exclusiva

Solo tú o el Director pueden marcar un medicamento como HELD. Se usa cuando debe retenerse temporalmente por razón clínica.

1. Identificar el medicamento
2. Marcar como HELD con nota clínica justificada
3. Documentar la orden médica o razón clínica
4. Notificar al cuidador asignado para que no intente administrarlo
5. Cuando el HOLD termina: reactivar y documentar

**El cuidador no puede marcar HELD — si considera que no debe administrarse, debe notificarte.**

---

### Escalas de riesgo

**Downton (0–6) — Riesgo de caídas:**
- 0–2: Bajo — medidas estándar
- 3–4: Moderado — protocolo activo
- 5–6: Alto — monitoreo intensivo

**Braden (6–23) — Riesgo de UPP:**
- 19–23: Sin riesgo
- 15–18: Bajo — cambios posturales preventivos
- 13–14: Moderado — cambios cada 2 horas
- ≤12: Alto — protocolo intensivo

Actualizar las escalas: después de cualquier caída o incidente clínico, ante cambios de movilidad, y como mínimo mensualmente en residentes de riesgo moderado o alto.

---

### Respuesta ante caídas con lesión

Tú diriges la evaluación clínica:
1. Estado de consciencia y signos vitales
2. Extremidades, columna, cabeza
3. Decisión de movilización
4. Si hay lesión: llamar al médico de cabecera
5. Si hay emergencia: 911 + notificar al Director
6. Documentar evaluación clínica en el ticket de Zendity

---

### Prevención de UPPs

Revisa /corporate/medical/upp-dashboard diariamente:
- Verificar que el protocolo de cambios posturales se ejecuta
- Documentar estado de UPPs activas: etapa, tamaño, tratamiento
- Actualizar el plan si el estado cambia
- Notificar al médico si una UPP avanza de etapa

---

### Dinámica de Reflexión Práctica

**Escenario:** El cuidador te llama a las 11pm. El residente de habitación 12 tiene un medicamento antihipertensivo programado para las 10pm que no fue administrado porque el residente estaba "muy dormido y no quería despertar". La ventana ya venció — aparece como MISSED.

El residente tiene historial de hipertensión severa. ¿Qué haces? ¿Qué estado final queda en el eMAR y por qué?`
  },
  {
    title: "Turno Nocturno — Protocolo del Cuidador 10PM–6AM",
    description: "Protocolo completo para el turno nocturno: vigilancia de residentes, toma de decisiones autónoma, incidentes nocturnos, eMAR nocturno y handover de salida a las 6am.",
    category: "Formación de Piso",
    targetRole: "CAREGIVER",
    durationMins: 25,
    bonusCompliance: 10,
    imageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
    content: `### El turno nocturno es diferente

Sin supervisor físico, equipo reducido, residentes en reposo, handover completamente virtual. La ausencia del supervisor no reduce tu responsabilidad — la concentra en ti.

---

### Inicio del turno — 10:00 PM

Antes de entrar al piso:
1. Login y Prólogo del Turno de Zendi AI
2. Leer el handover vespertino completo
3. Confirmar recepción en Zendity
4. Identificar residentes con novedades
5. Verificar medicamentos nocturnos pendientes

Hacer ronda de verificación inicial — sin despertar a nadie, solo observación visual.

---

### Línea de tiempo nocturna

**10:30 PM** — Medicamentos nocturnos del eMAR
**12:00 AM** — Ronda + cambios posturales de residentes con protocolo UPP
**2:00 AM** — Ronda completa + necesidades nocturnas (hidratación, cambio, reposicionamiento)
**4:00 AM** — Ronda final + preparar documentación del turno
**5:00 AM** — Redactar handover + cierre de turno
**6:00 AM** — Entrega presencial al equipo diurno

---

### Señales nocturnas de alerta

| Señal | Qué hacer |
|---|---|
| Respiración irregular | Acercarse, evaluar, llamar al supervisor si persiste |
| Agitación o movimientos bruscos | Orientar con calma, documentar |
| Residente fuera de cama solo | Acompañar inmediatamente — riesgo de caída |
| No responde al llamado | Verificar consciencia — si no responde: 911 |

---

### Cuándo actuar solo vs cuándo escalar

**Puedes actuar solo:**
- Administrar medicamentos programados
- Asistir al residente en necesidades básicas
- Registrar observaciones en el sistema

**Siempre contactar al supervisor remoto primero:**
- Caída de cualquier tipo
- Residente que no responde
- Agitación severa que no cede
- Duda sobre si administrar un medicamento

---

### Caída nocturna — respuesta inmediata

1. Acudir al residente de inmediato
2. Hablarle por su nombre — evaluar consciencia
3. **No mover** — evaluar visualmente
4. Contactar al supervisor remoto via Zendity
5. Si hay emergencia: 911 primero, luego supervisor
6. Documentar en Zendity — crear ticket INCIDENTE DE CAÍDA

---

### Handover de salida — 6:00 AM

El equipo diurno va a manejar a los residentes en las horas de mayor actividad. Tu handover debe incluir:
- Cómo durmió cada residente
- Incidentes de la noche aunque estén resueltos
- Medicamentos y cualquier MISSED justificado
- Cambios clínicos observados
- Infraestructura que requiere atención

**No puedes salir hasta que el cuidador diurno confirme el handover en Zendity.**

---

### Dinámica de Reflexión Práctica

**Escenario:** Son las 3am. Al hacer la ronda encuentras a la residente de habitación 5 en el suelo del baño. Está consciente, un poco confusa, dice que "solo fue al baño". Quiere que la levantes de inmediato para no hacer escándalo.

Describe exactamente qué haces en los próximos 15 minutos, incluyendo cómo usas Zendity y a quién contactas.`
  },
  {
    title: "Manual de Mantenimiento — Planta Física en Zendity",
    description: "Aprende a gestionar tickets reactivos y preventivos en el módulo de Planta Física, preparar cotizaciones para el Director y coordinar con el equipo de piso.",
    category: "Formación de Sede",
    targetRole: "MAINTENANCE",
    durationMins: 20,
    bonusCompliance: 10,
    imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80",
    content: `### Tu rol en el sistema Zendity

El personal de mantenimiento garantiza que el entorno donde viven los residentes sea seguro y funcional. Tu trabajo tiene impacto directo en la seguridad clínica de la sede.

---

### Doble línea de reporte

- **Al Supervisor** — coordinación operativa diaria, trabajos urgentes
- **Al Director** — presupuestos, cotizaciones, contratistas externos, inversiones

Agilidad en lo urgente, control en lo costoso.

---

### Tu módulo en Zendity — /maintenance

Desde aquí puedes:
- Ver todos los tickets activos ordenados por prioridad
- Aceptar y resolver tickets
- Documentar avance de trabajos en progreso
- Preparar y adjuntar cotizaciones
- Ver el calendario de inspecciones preventivas
- Revisar el historial completo de trabajos por área

---

### Clasificación de urgencia

| Prioridad | Tiempo de respuesta | Ejemplos |
|---|---|---|
| CRÍTICO | 2 horas | Fuga activa, fallo eléctrico, elevador bloqueado |
| ALTO | Mismo día | Cama dañada, aire acondicionado en habitación ocupada |
| MEDIO | 48 horas | Daño menor sin riesgo inmediato |
| BAJO | En la semana | Mejoras y ajustes menores |

---

### Flujo de resolución de un ticket

1. Revisar el ticket y evaluar el trabajo necesario
2. Si requiere materiales o contratista: preparar cotización → Director
3. Si es ejecución directa: proceder y notificar al Supervisor del avance
4. Al completar: marcar RESUELTO con nota de cierre
5. El reportante recibe notificación automática

---

### Cotizaciones para el Director

Una cotización debe incluir:
- Descripción del problema y trabajo propuesto
- Lista de materiales con precios
- Nombre del proveedor si aplica
- Tiempo estimado y si requiere cierre de área
- Impacto en residentes durante el trabajo

**Excepción CRÍTICA:** Si el trabajo no puede esperar aprobación, proceder y notificar al Director directamente — antes o durante, nunca solo después.

---

### Inspecciones preventivas

El calendario de Zendity tiene programadas las inspecciones. Al completar cada una:
1. Documentar estado de cada elemento inspeccionado
2. Si detectas algo: crear ticket correctivo inmediatamente
3. Marcar el evento como COMPLETADO con nota de resultado

---

### Coordinar con el Supervisor

Siempre avisar antes de:
- Entrar a habitaciones ocupadas
- Cerrar temporalmente áreas comunes
- Usar químicos con olor fuerte cerca de residentes
- Hacer trabajos ruidosos en turno nocturno

---

### Dinámica de Reflexión Práctica

**Escenario:** Son las 9am del lunes. El Supervisor te reporta que el aire acondicionado del ala norte no funcionó en toda la noche — 3 habitaciones de residentes RED sin climatización. El sistema requiere un técnico especializado que cuesta $280 por servicio.

¿Cómo procedes? ¿Cuándo puedes actuar sin esperar aprobación del Director y cuándo necesitas esperarla?`
  },
  {
    title: "Manual del Personal de Cocina — Módulo Cocina en Zendity",
    description: "Aprende a usar el módulo de cocina: censo de dietas, registro de observaciones con ZendiAssist, menú del día y comunicación con el supervisor.",
    category: "Formación de Sede",
    targetRole: "KITCHEN",
    durationMins: 15,
    bonusCompliance: 10,
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    content: `### Tu rol en el cuidado de los residentes

La alimentación es parte fundamental del cuidado clínico. El personal de cocina es responsable de que cada residente reciba la dieta adecuada a su condición médica, con calidad y consistencia.

---

### Tu módulo en Zendity — /kitchen

Desde aquí tienes acceso a:
- **Censo de dietas activo** — qué tipo de dieta tiene cada residente hoy
- **Menú del día** — desayuno, almuerzo y cena programados
- **Observaciones de cocina** — registrar feedback por comida
- **KPIs de la semana** — score promedio, observaciones positivas, sin leer

---

### Tipos de dieta en el sistema

| Tipo | Descripción clínica |
|---|---|
| Sólido (Regular) | Sin restricciones alimentarias especiales |
| Mojado (Blanda) | Dificultad para masticar — textura suave |
| PEG | Alimentación por sonda gástrica percutánea |
| Diabética | Control de carbohidratos y azúcares |

**Nunca servir una dieta diferente a la registrada en el sistema. Las dietas son prescripción clínica.**

---

### Registrar observaciones por comida

Después de cada servicio, registrar en Zendity:
1. Seleccionar el tipo de comida: Desayuno, Almuerzo o Cena
2. Seleccionar el tipo de feedback: Positivo, Negativo o Neutro
3. Indicar si las porciones fueron adecuadas
4. Agregar observación textual — usar el botón ✦ de ZendiAssist

ZendiAssist modo KITCHEN_OBS convierte tus notas en observaciones clínicas estructuradas.

**Ejemplo:**
Entrada: "la sopa estaba muy salada y varios la rechazaron"
Salida: "Se registra exceso de sodio en preparación de sopa del almuerzo. Múltples residentes presentaron rechazo de la preparación. Se recomienda ajuste en proceso de sazón."

---

### Comunicación con el Supervisor

El Supervisor recibe tus observaciones desde su dashboard. Si hay un problema de alimentación que afecta a un residente específico — rechazo total de comidas, reacción a un alimento — notificar directamente al Supervisor además de registrarlo en el sistema.

---

### Residentes que no comieron

Si un residente rechazó una comida completa, registrarlo en Zendity con nota. El supervisor y el cuidador asignado ven esta información en tiempo real. Una ingesta deficiente repetida puede ser señal clínica relevante.

---

### Dinámica de Reflexión Práctica

**Escenario:** En el almuerzo de hoy, la residente de habitación 7 que tiene dieta diabética le pide que le sirva el postre de los demás residentes. Ella insiste y dice que "una vez no hace daño".

¿Qué haces? ¿Puedes tomar esa decisión tú solo o necesitas consultar con alguien?`
  }
];

async function main() {
    console.log('Sembrando cursos cerrados por rol...\n');
    for (const course of roleCourses) {
        const existing = await prisma.course.findFirst({
            where: { title: course.title, headquartersId: HQ_ID }
        });
        if (existing) {
            await prisma.course.update({
                where: { id: existing.id },
                data: {
                    description: course.description,
                    content: course.content,
                    category: course.category,
                    targetRole: course.targetRole,
                    durationMins: course.durationMins,
                    bonusCompliance: course.bonusCompliance,
                    imageUrl: course.imageUrl,
                    isGlobal: false,
                    isActive: true
                }
            });
            console.log(`✓ Actualizado: ${course.title} [${course.targetRole}]`);
        } else {
            await prisma.course.create({
                data: {
                    headquartersId: HQ_ID,
                    title: course.title,
                    description: course.description,
                    content: course.content,
                    category: course.category,
                    targetRole: course.targetRole,
                    durationMins: course.durationMins,
                    bonusCompliance: course.bonusCompliance,
                    imageUrl: course.imageUrl,
                    isGlobal: false,
                    isActive: true
                }
            });
            console.log(`✓ Creado: ${course.title} [${course.targetRole}]`);
        }
    }
    console.log('\n✅ Cursos cerrados por rol sembrados correctamente.');
    console.log('Roles cubiertos: DIRECTOR, ADMIN, SUPERVISOR, CAREGIVER (x2), NURSE, MAINTENANCE, KITCHEN');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
