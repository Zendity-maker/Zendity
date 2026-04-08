import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const HQ_ID = "b2ac0700-f937-4085-9595-dcf81a2e5e30";

const courses = [
  {
    code: "CIERRE_TURNO_101",
    emoji: '📋',
    title: "Proceso de Cierre de Turno",
    description: "Aprende el flujo completo para cerrar tu turno correctamente en Zendity: pre-scan automático, resolución de blockers, notas de handover y firma electrónica.",
    category: "Operaciones de Piso",
    durationMins: 20,
    bonusCompliance: 10,
    content: `### ¿Por qué importa el Cierre de Turno?

Un turno no termina cuando el cuidador sale físicamente — termina cuando el sistema lo confirma. El cierre formal protege al residente, valida la responsabilidad del cuidador y garantiza que el equipo entrante tenga toda la información necesaria.

**Principio clave:** El turno no está cerrado hasta que Zendity lo confirme.

---

### Paso 1 — Pre-scan Automático

Cuando inicias el cierre, Zendity escanea tu turno en menos de 3 segundos. Busca:

- Medicamentos del eMAR sin administrar ni justificar
- Residentes sin nota de Daily Log
- Handover del turno anterior no recibido formalmente
- Tareas de triage sin resolución

El pre-scan es de solo lectura — no puedes modificar sus resultados.

---

### Paso 2 — Blockers vs Warnings

Los pendientes se clasifican automáticamente:

**BLOQUEADORES** — impiden el cierre:
- Dosis crítica sin administrar ni justificar
- Residente en alerta sin evaluación documentada
- Tarea INMINENTE no resuelta ni transferida

**ADVERTENCIAS** — puedes reconocer y continuar:
- Nota de Daily Log opcional no completada
- Tarea de baja prioridad transferida al siguiente turno

---

### Paso 3 — Quick Resolutions

Para cada bloqueador tienes opciones de resolución inline:
- **Marcar como OMITIDO** — requiere justificación escrita
- **Transferir al siguiente turno** — para tareas que no comprometen seguridad
- **Registrar nota de justificación** — Zendi AI te ayuda a redactarla
- **Marcar como RECHAZADO por residente** — documenta el rechazo

---

### Paso 4 — Notas de Handover

El campo de handover es obligatorio. Debes incluir:
- Estado clínico de los residentes al cierre
- Incidentes ocurridos aunque ya estén documentados
- Tareas transferidas con contexto suficiente
- Instrucciones médicas recibidas verbalmente

Usa el botón ✦ de Zendi AI para transformar tus notas coloquiales en terminología clínica estructurada.

---

### Paso 5 — Firma Electrónica

Tu firma digital certifica que la información es completa y veraz. Genera un registro inmutable con timestamp, tu ID y hash de los datos del turno. No puede eliminarse ni modificarse.

---

### Paso 6 — Cierre Transaccional

Al confirmar la firma, el sistema automáticamente:
- Registra el handover formal
- Libera tu sesión activa
- Notifica al supervisor
- Actualiza tareas transferidas para el turno entrante

---

### Override Forzado — Solo en emergencias

Si debes salir y no puedes resolver los blockers, puedes usar el Override Forzado. Esto queda registrado como excepción auditada y el supervisor recibe alerta inmediata. **No elimina los blockers — los transfiere como deuda pendiente.**

---

### Dinámica de Reflexión Práctica

**Escenario:** Es fin de tu turno. El pre-scan detecta que la dosis de las 9pm del residente en habitación 4 no fue administrada ni justificada (BLOQUEADOR) y que la nota del Daily Log del residente en habitación 7 está vacía (ADVERTENCIA).

¿Cuál es el orden correcto de tus acciones y qué haces con cada uno de estos dos pendientes antes de poder firmar el cierre?`
  },
  {
    code: "ADMISION_RESIDENTES_101",
    emoji: '🏥',
    title: "Admisión de Nuevos Residentes",
    description: "Domina el flujo completo de admisión: desde el primer contacto familiar en el CRM hasta la activación clínica del perfil del residente en Zendity.",
    category: "Área Clínica",
    durationMins: 25,
    bonusCompliance: 10,
    content: `### La Admisión como Evento Fundacional

La información registrada durante la admisión alimenta directamente el eMAR, el PAI, el calendario operativo y el perfil clínico del residente. Una admisión incompleta genera un residente con perfil deficiente.

**Solo el Director o Admin corporativo puede iniciar una admisión.**

---

### Fase 1 — Pre-Ingreso en el CRM

Cuando una familia contacta la sede, se crea un Lead en el CRM (/corporate/crm). El Lead avanza por estas etapas:

1. **Nuevo contacto** — datos básicos, sin compromiso
2. **En evaluación** — familia considera activamente
3. **Documentos pendientes** — familia confirmó interés
4. **Contrato en proceso** — documentos recibidos
5. **Residente parcial** — contrato firmado, pendiente fecha
6. **Admitido** — ingreso completado

---

### Fase 2 — Intake Maestro (4 Tabs)

Ruta: Corporate HQ → Área Clínica / Médica → Admisión de Residentes

**Tab 1 — Identidad Fundamental**
Nombre completo, fecha de nacimiento, habitación, grupo de color (RED/YELLOW/GREEN/BLUE), tipo de dieta, escalas iniciales.

**Tab 2 — Triage Clínico**
Alergias (alerta crítica en eMAR), diagnósticos activos, historial quirúrgico, movilidad, continencia.

**Tab 3 — PAI y Escalas de Riesgo**
- Escala Downton (0–6): riesgo de caídas
- Escala Braden (6–23): riesgo de úlceras — menor puntuación = mayor riesgo

**Tab 4 — Log Farmacológico**
Los medicamentos quedan en estado **DORMANT** hasta que el Director los active. Esto previene errores en admisiones nuevas.

---

### Documentos Mínimos Requeridos

- Identificación oficial del residente
- Historia clínica reciente (no mayor a 6 meses)
- Recetario de medicamentos firmado por médico
- Contrato de servicio firmado

---

### Activación Clínica

Cuando el Director activa el perfil:
- Medicamentos pasan de DORMANT a ACTIVE
- Se genera el borrador del PAI
- Se crean eventos preventivos en el Calendario
- El supervisor recibe notificación
- El residente aparece en el Wall of Care

---

### Dinámica de Reflexión Práctica

**Escenario:** Estás completando la admisión de un nuevo residente. Al llegar al Tab 4, la familia no tiene el recetario firmado por el médico — solo una lista escrita a mano con los medicamentos y dosis.

¿Qué debes hacer con los medicamentos en este punto? ¿Puedes activar el perfil del residente? Explica por qué y qué pasos seguirías.`
  },
  {
    code: "EMAR_101",
    emoji: '💊',
    title: "Administración de Medicamentos — eMAR",
    description: "Aprende a usar el registro electrónico de medicamentos: la regla de los 5 correctos, los estados del eMAR, el manejo de rechazos y medicamentos PRN.",
    category: "Área Clínica",
    durationMins: 30,
    bonusCompliance: 15,
    content: `### El eMAR es el Corazón del Cuidado Clínico

El eMAR (Electronic Medication Administration Record) documenta cada administración en tiempo real. **El medicamento se registra en el momento exacto de la administración — no antes, no después.**

---

### La Regla de los 5 Correctos

Antes de administrar cualquier medicamento, verificar:

1. **Residente correcto** — confirmar nombre y habitación
2. **Medicamento correcto** — verificar nombre y presentación
3. **Dosis correcta** — verificar cantidad indicada en el eMAR
4. **Vía correcta** — oral, tópica, sublingual, etc.
5. **Hora correcta** — dentro de la ventana de gracia

---

### Flujo Paso a Paso

1. Abrir el eMAR del residente desde la tablet (/care/emar)
2. Verificar que el medicamento corresponde al residente correcto
3. Verificar el medicamento físico contra el eMAR
4. Verificar alergias activas — aparecen como alerta roja
5. Administrar el medicamento
6. Tocar el botón ADMINISTRAR inmediatamente
7. Agregar observación si hay algo relevante

---

### Estados del eMAR

| Estado | Significado |
|---|---|
| **PENDING** | Dentro de ventana, aún no administrado |
| **ADMINISTERED** | Administrado exitosamente |
| **MISSED** | Ventana vencida sin registro |
| **REFUSED** | Residente rechazó el medicamento |
| **OMITTED** | Omitido por razón clínica válida |
| **HELD** | Retenido por orden médica |

---

### Ventana de Gracia

Para medicamentos de horario fijo: **30 minutos antes y 30 minutos después**. Pasada la ventana, el sistema marca automáticamente como MISSED y notifica al supervisor.

---

### Protocolo de Rechazo

Cuando un residente rechaza su medicamento:
1. Intentar una segunda vez con calma
2. Si persiste el rechazo — **no forzar nunca**
3. Registrar como RECHAZADO con nota detallada
4. Notificar al supervisor inmediatamente

Un patrón de más de 2 rechazos del mismo medicamento en una semana debe notificarse al Director Clínico.

---

### Medicamentos PRN (A Demanda)

Solo se administran cuando el residente presenta la condición que los justifica. El eMAR muestra el tiempo desde la última dosis. Respetar siempre el intervalo mínimo.

---

### Dinámica de Reflexión Práctica

**Escenario:** Son las 8:45am. El medicamento de las 8am del residente en habitación 3 aparece como MISSED. Al revisar, descubres que el residente estaba en una cita médica externa desde las 7:30am y acaba de regresar.

¿Qué estado debes usar para registrar esta situación y qué información debe incluir la nota? ¿Debes notificar al supervisor aunque ya tengas la explicación?`
  },
  {
    code: "INCIDENTES_CAIDA_101",
    emoji: '⚠️',
    title: "Respuesta a Incidentes de Caída",
    description: "Aprende a responder correctamente ante una caída: evaluación inicial, documentación en Zendity, cadena de notificaciones y medidas preventivas post-incidente.",
    category: "Seguridad Clínica",
    durationMins: 25,
    bonusCompliance: 15,
    content: `### Las Caídas son Prevenibles — y Manejables

Las caídas son el evento adverso más frecuente en hogares de envejecientes. La respuesta en los primeros minutos determina el resultado clínico.

**Principio fundamental:** Primero la seguridad del residente — luego la documentación. Nunca mover a un residente caído sin evaluación clínica previa.

---

### Los Primeros 5 Minutos

Cuando encuentras o presencias una caída:

1. Mantener la calma — hablarle al residente por su nombre
2. Llamar a la enfermera o supervisor inmediatamente
3. **No mover al residente** mientras esperas apoyo
4. Evaluar visualmente: ¿responde? ¿hay sangrado? ¿se queja de dolor?
5. Si no responde o hay emergencia — llamar al 911
6. Permanecer con el residente hasta que llegue la enfermera

---

### Evaluación Clínica (Enfermera)

La enfermera evalúa:
- Estado de consciencia y orientación
- Signos vitales
- Extremidades: deformidad, dolor, limitación de movimiento
- Cabeza: golpe, hematoma, laceración
- Columna: dolor cervical o lumbar
- Neurológico: confusión, habla alterada

---

### Clasificación de Severidad

| Nivel | Criterios | Respuesta |
|---|---|---|
| **BAJO** | Sin lesión, alerta y orientado | Documentar, notificar supervisor y familia |
| **MEDIO** | Hematoma o laceración menor | Documentar, notificar Director, llamar familia |
| **ALTO** | Dolor intenso, posible fractura | Llamar médico, notificar Director, familia inmediata |
| **CRÍTICO** | Pérdida de consciencia, sangrado severo | 911 + botón hospitalización de emergencia en Zendity |

---

### Documentación en Zendity

Acceso: Triage Center → nuevo ticket → INCIDENTE DE CAÍDA

La nota debe incluir:
- Dónde ocurrió exactamente
- Qué hacía el residente
- Si hubo testigos
- Estado del residente post-caída
- Lesiones encontradas
- Acciones tomadas

**Tiempo máximo:** antes del cierre del turno en que ocurrió.

---

### Notificaciones Obligatorias

**La familia siempre debe ser notificada** — toda caída, sin importar la severidad. Esta es una política de transparencia absoluta.

El médico de cabecera se llama cuando hay lesión visible o el residente se queja de dolor.

---

### Prevención Post-Caída

Después de cualquier caída:
- Revisar el área donde ocurrió
- Verificar calzado del residente
- Actualizar el score Downton si es necesario
- Documentar en el handover del turno

---

### Dinámica de Reflexión Práctica

**Escenario:** Encuentras a la residente de habitación 6 en el suelo del baño. Está consciente y te dice que "solo se resbaló" y que está bien. Quiere que la ayudes a levantarse de inmediato porque siente vergüenza.

Describe paso a paso qué debes hacer, incluyendo por qué NO debes levantarla inmediatamente aunque ella lo pida.`
  },
  {
    code: "HANDOVER_101",
    emoji: '🤝',
    title: "Handover de Enfermería y Relevo de Turno",
    description: "Domina el proceso de entrega formal del turno: qué documentar, cómo hacerlo en Zendity, y la diferencia entre el handover presencial, supervisado y virtual.",
    category: "Operaciones de Piso",
    durationMins: 20,
    bonusCompliance: 10,
    content: `### El Handover es el Momento Más Crítico del Ciclo Operativo

Un handover deficiente es la causa más frecuente de errores clínicos, medicamentos omitidos y situaciones sin atender. **El turno no termina hasta que el relevo esté completo.**

---

### Los Tres Tipos de Handover

**Tipo 1 — Presencial (cambio de madrugada/mañana)**
El turno saliente deja todo documentado en Zendity antes del cambio. Los equipos se reúnen brevemente. El entrante lee el resumen en tablet y confirma recepción con firma digital. Zendi AI lee el Prólogo del Turno al entrante.

**Tipo 2 — Presencial Supervisado (tarde)**
El supervisor está presente. El saliente presenta novedades por residente. El supervisor agrega contexto del día. El entrante puede hacer preguntas directamente.

**Tipo 3 — Virtual via Tablet (noche)**
El saliente documenta todo en Zendity antes del cambio. El nocturno recibe notificación en tablet y debe confirmar lectura antes de entrar al piso. Si tiene dudas, puede contactar al supervisor via mensajería interna.

---

### Contenido Obligatorio del Handover

Todo handover debe incluir:

- **Estado clínico por residente** — cambios en salud, ánimo, alimentación, comportamiento
- **eMAR del turno** — administrados, MISSED con justificación, rechazos
- **Incidentes** — caídas, quejas, agitación, visitas familiares con novedades
- **Tareas transferidas** — con contexto suficiente para el entrante
- **Instrucciones médicas** — cualquier indicación verbal no registrada aún
- **Novedades de infraestructura** — equipos dañados, materiales agotados

---

### Zendi AI en el Handover

El botón ✦ en el campo de handover transforma lenguaje coloquial en terminología clínica:

*Entrada:* "Doña Carmen estuvo inquieta toda la noche, no quiso cenar"

*Salida:* "Residente presenta estado de agitación sostenida durante el turno. Rechazo de ingesta alimentaria en cena. Se recomienda evaluación de estado en turno diurno."

---

### Handover Incompleto — Consecuencias

Si el handover no es confirmado por el entrante:
- El turno saliente queda marcado como HANDOVER PENDIENTE
- El entrante recibe alerta de información sin confirmar
- Si pasan 30 minutos sin confirmación — el supervisor recibe alerta escalada
- El cierre del saliente queda marcado como incompleto en auditoría

El sistema bloquea el cierre si el handover no fue recibido. Requiere Override para forzarlo.

---

### Dinámica de Reflexión Práctica

**Escenario:** Es el fin de tu turno vespertino (2pm-10pm). Estás escribiendo las notas de handover para el turno nocturno que entra a las 10pm y no habrá supervisor presente en ese cambio.

Un residente tuvo un episodio de agitación a las 8pm que se calmó solo, no requirió intervención. ¿Debes incluirlo en el handover aunque ya "pasó"? ¿Qué información exactamente debe quedar documentada?`
  },
  {
    code: "ZENDI_AI_101",
    emoji: '🤖',
    title: "Uso de Zendi AI en la Práctica Diaria",
    description: "Aprende a sacarle el máximo provecho a Zendi AI: el botón flotante, ZendiAssist en campos de escritura, los 5 modos especializados y el Prólogo del Turno.",
    category: "Tecnología Zendity",
    durationMins: 15,
    bonusCompliance: 10,
    content: `### Zendi AI: Tu Asistente Clínico Especializada

Zendi no es un chatbot genérico. Es una asistente entrenada para el contexto de hogares de envejecientes. Su filosofía: **breve, precisa, no intrusiva**.

Zendi amplifica tu capacidad — no reemplaza tu criterio clínico.

---

### Modo 1 — Zendi Conversacional (Botón Flotante)

El botón teal en la esquina inferior derecha activa el modo conversacional. Puedes hablarle por voz o escribirle.

**Úsalo para:**
- Consultar el estado de un residente
- Preguntar sobre protocolos del sistema
- Pedir un resumen del turno
- Consultar medicamentos activos
- Recibir el Prólogo del Turno

**No lo uses para:**
- Tomar decisiones clínicas
- Prescribir o modificar medicamentos
- Reemplazar la evaluación de la enfermera

---

### Modo 2 — ZendiAssist Inline (Botón ✦)

En los campos de escritura del sistema aparece el botón ✦. Al tocarlo, Zendi mejora tu texto según el contexto del campo.

**Los 5 modos especializados:**

| Modo | Contexto | Temperatura |
|---|---|---|
| FORMAT_NOTES | Notas clínicas | Precisa y estructurada |
| SUPERVISOR_MEMO | Comunicaciones RRHH | Formal y directiva |
| CORPORATE_COMMS_POLISH | Emails institucionales | Profesional y elevada |
| FAMILY_MESSAGE | Mensajes a familias | Cálida y empática |
| KITCHEN_OBS | Observaciones cocina | Concisa y objetiva |

---

### El Prólogo del Turno

Al hacer clock-in, Zendi lee en voz neural un resumen personalizado de tu turno. Incluye:
- Residentes que requieren atención especial
- Medicamentos pendientes para las primeras horas
- Novedades del turno anterior
- Eventos del calendario relevantes

La voz es neural (OpenAI TTS) — no la voz genérica del navegador.

---

### Límites de Zendi — Lo Que NO Hace

- No toma acciones sin tu confirmación
- No prescribe ni cambia medicamentos
- No diagnostica condiciones médicas
- No accede a información fuera de tu sede
- No guarda conversaciones entre sesiones
- No reemplaza tu firma en el cierre

**Todo output de Zendi debe ser revisado antes de guardar.**

---

### Dinámica de Reflexión Práctica

**Escenario:** Terminas tu turno y necesitas escribir la nota de handover. En tu tablet escribes: "el señor de la 8 estuvo raro hoy, no quiso comer y se quedó dormido en la silla como 3 horas, también se quejó de que le dolía la espalda cuando lo moví para bañarlo".

Describe cómo usarías el botón ✦ de ZendiAssist en este contexto. ¿Qué modo se activaría automáticamente? ¿Qué aspectos de tu nota original son los más importantes que Zendi debe preservar en su versión mejorada?`
  },
  {
    code: "ACCESO_ROLES_101",
    emoji: '🔐',
    title: "Acceso, Roles y Seguridad en Zendity",
    description: "Entiende el sistema RBAC de Zendity: qué puede hacer cada rol, cómo crear y desactivar usuarios, y las buenas prácticas de seguridad del PIN.",
    category: "Tecnología Zendity",
    durationMins: 15,
    bonusCompliance: 10,
    content: `### Acceso Basado en Roles (RBAC)

Zendity opera bajo Control de Acceso Basado en Roles. Cada usuario solo puede ver y hacer lo que su rol permite. Este diseño protege a los residentes, al personal y a la sede.

**Principio:** El acceso mínimo necesario para cumplir la función — nada más.

---

### Los 7 Roles del Sistema

| Rol | Función | Workspace |
|---|---|---|
| SUPER_ADMIN | Equipo técnico Zendity | Superadmin |
| DIRECTOR | Director de la sede | Corporate HQ completo |
| ADMIN | Admin corporativo delegado | Corporate HQ operativo |
| SUPERVISOR | Supervisor de turno | Dashboard de supervisión |
| NURSE | Enfermera clínica | Handovers y perfil clínico |
| CAREGIVER | Cuidador de piso | eMAR, calendario, piso |
| KITCHEN | Personal de cocina | Módulo de cocina |

---

### Cuidador (CAREGIVER) — Tu Acceso

Como cuidador puedes acceder a:
- /care — Hub principal de piso
- /care/emar — Administración de medicamentos
- /care/calendar — Calendario transversal táctil
- /wall — Wall of Care (solo lectura)

**No puedes acceder a:** Corporate HQ, RRHH, facturación, ni al dashboard de supervisión.

---

### El Sistema de PIN

Zendity no usa contraseñas — el acceso es por **email + PIN de 4 dígitos**.

- El PIN es personal e intransferible
- Compartirlo viola el protocolo de seguridad
- Puedes cambiarlo en cualquier momento desde Mi Perfil
- Si olvidas tu PIN, el Director puede resetearlo

---

### Crear y Desactivar Usuarios

Solo el Director o Admin puede crear usuarios. No existe autoregistro.

**Al crear:** nombre, email, teléfono, rol, sede. El sistema genera el PIN automáticamente.

**Al dar de baja:** el Director cambia el estado a INACTIVO ese mismo día. El acceso se revoca inmediatamente. Los registros del empleado se conservan permanentemente para auditoría HIPAA.

---

### Ante Pérdida de Tablet

Si tu tablet con sesión activa se pierde:
1. Notificar al Director inmediatamente
2. El Director fuerza el cierre de tu sesión desde Directorio Staff
3. Tu PIN es reseteado
4. El incidente queda registrado en el log de auditoría

---

### Buenas Prácticas

- Nunca compartir tu PIN
- Cerrar sesión en la tablet al terminar el turno
- Reportar si sospechas que alguien usa tus credenciales
- Si tu PIN fue comprometido — cambiarlo de inmediato

---

### Dinámica de Reflexión Práctica

**Escenario:** Una compañera cuidadora te pide tu PIN "por esta vez" porque ella olvidó el suyo y necesita registrar urgentemente una administración de medicamento antes de que venza la ventana de gracia.

¿Qué debes hacer? Explica por qué es importante no compartir el PIN incluso en situaciones que parecen urgentes, y cuál es la solución correcta para este escenario.`
  },
  {
    code: "MANTENIMIENTO_101",
    emoji: '🔧',
    title: "Planta Física y Mantenimiento",
    description: "Aprende a gestionar los tickets de mantenimiento en Zendity, el flujo de cotizaciones con el Director, las inspecciones preventivas y la coordinación con el equipo de piso.",
    category: "Operaciones de Sede",
    durationMins: 20,
    bonusCompliance: 10,
    content: `### Mantenimiento: La Columna Vertebral de la Sede

El personal de mantenimiento garantiza que el entorno donde viven y son cuidados los residentes sea seguro, funcional y digno. Su trabajo tiene impacto directo en la seguridad clínica.

---

### Doble Línea de Reporte

- **Al Supervisor** — coordinación operativa diaria, trabajos urgentes, comunicación de impacto en el piso
- **Al Director** — presupuestos, cotizaciones, contratistas externos, inversiones

Esta dualidad garantiza agilidad en lo urgente y control en lo costoso.

---

### Flujo de Trabajo Reactivo — Tickets

Cuando el equipo de piso reporta un daño, llega un ticket al módulo de Planta Física (/maintenance).

**Clasificación de urgencia:**
- **CRÍTICO** — riesgo inmediato para residentes, responder en 2 horas
- **ALTO** — afecta la operación del turno, resolver el mismo día
- **MEDIO** — afecta comodidad, no seguridad — 48 horas
- **BAJO** — mejoras menores — en la semana

**Proceso de resolución:**
1. Revisar el ticket y evaluar el trabajo
2. Si requiere materiales o contratista: preparar cotización → Director
3. Si es de ejecución directa: proceder y notificar al Supervisor del avance
4. Al completar: marcar RESUELTO con nota de cierre
5. El reportante recibe notificación automática

---

### Flujo de Trabajo Preventivo — Calendario

Las inspecciones preventivas se programan en el Calendario Corporativo de Zendity.

**Inspecciones recomendadas:**
- Equipos de movilidad y camas — mensual
- Plomería y sanitarios — mensual
- Áreas comunes — quincenal
- Sistemas eléctricos — trimestral
- Climatización HVAC — trimestral

Al completar cada inspección: documentar resultados, crear ticket correctivo si se detecta algo, marcar el evento como COMPLETADO.

---

### Gestión de Cotizaciones

Cuando el trabajo requiere inversión, preparar:
- Descripción del problema y trabajo propuesto
- Lista de materiales con precios
- Nombre del proveedor si aplica
- Tiempo estimado y si requiere cierre de área
- Impacto en residentes durante el trabajo

La cotización va adjunta al ticket. El Director aprueba o rechaza desde el módulo.

**Excepción:** En trabajos CRÍTICOS que no pueden esperar, proceder y notificar al Director directamente — antes o durante, nunca solo después.

---

### Coordinación con el Supervisor

Siempre coordinar con el Supervisor para:
- Acceso a habitaciones ocupadas
- Cierre temporal de áreas comunes
- Trabajos ruidosos en turno nocturno
- Uso de químicos con olor fuerte cerca de residentes

---

### Dinámica de Reflexión Práctica

**Escenario:** Son las 10pm. Recibes un reporte de que hay una fuga de agua activa en el baño compartido del ala B. Al revisar, confirmas que la fuga es significativa y el piso está mojado — riesgo real de caída para los residentes. El costo de la reparación va a requerir un plomero externo que cuesta aproximadamente $350.

Describe paso a paso lo que harías en los próximos 30 minutos, incluyendo cómo usarías Zendity y cómo manejarías el tema del presupuesto dado que es de noche y el Director no está en la sede.`
  }
];

async function main() {
    console.log('Sembrando 8 cursos oficiales de Zendity Academy...');

    for (const course of courses) {
        const existing = await prisma.course.findFirst({
            where: { headquartersId: HQ_ID, title: course.title }
        });

        if (existing) {
            await prisma.course.update({
                where: { id: existing.id },
                data: {
                    description: course.description,
                    content: course.content,
                    category: course.category,
                    durationMins: course.durationMins,
                    bonusCompliance: course.bonusCompliance,
                    emoji: course.emoji || null,
                    isGlobal: true,
                    isActive: true
                }
            });
            console.log(`✓ Actualizado: ${course.title}`);
        } else {
            await prisma.course.create({
                data: {
                    headquartersId: HQ_ID,
                    title: course.title,
                    description: course.description,
                    content: course.content,
                    category: course.category,
                    durationMins: course.durationMins,
                    bonusCompliance: course.bonusCompliance,
                    emoji: course.emoji || null,
                    isGlobal: true,
                    isActive: true
                }
            });
            console.log(`✓ Creado: ${course.title}`);
        }
    }

    console.log('\n✅ 8 cursos oficiales sembrados correctamente.');
    console.log('Total bonus compliance por serie completa: 90 puntos');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
