// ── Academy Seed Data ──────────────────────────────────────────────────────────
// 3 cursos completos con formato estructurado ---META--- / ---SECCION_N---
// Ejecutar: npx tsx src/lib/academy-seed.ts

export interface AcademySeedCourse {
    id: string;
    title: string;
    description: string;
    content: string;
    durationMins: number;
    bonusCompliance: number;
    emoji: string;
    category?: string;
}

export const ACADEMY_SEED_COURSES: AcademySeedCourse[] = [

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 1: ACCESO Y ROLES EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ACCESO_ROLES_101',
    title: 'Acceso y Roles en Zendity',
    description: 'Aprende a navegar el sistema Zendity, comprender los roles de usuario y aplicar las mejores practicas de seguridad digital en tu facilidad.',
    durationMins: 25,
    bonusCompliance: 75,
    emoji: '🔐',
    content: `---META---
TITULO: Acceso y Roles en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende la importancia de la seguridad de datos, los roles del sistema, y puede identificar situaciones donde debe proteger las credenciales y escalar un problema de acceso.
TERMINOS_CLAVE: roles, permisos, HIPAA, PIN, seguridad, Sede, trazabilidad, sesion, confidencialidad, modulos
PREGUNTA_REFLEXION: Imagina que un companero de trabajo te pide prestado tu PIN para registrar un medicamento porque "el suyo no funciona". Que harias y por que? Relaciona tu respuesta con los principios de seguridad y roles que aprendiste en este curso.

---SECCION_1---
LECTURA:
# Bienvenida a Zendity

Zendity es una plataforma digital de gestion integral disenada especificamente para facilidades de cuido de adultos mayores (senior living). La plataforma centraliza todas las operaciones: desde la admision de residentes, el manejo clinico diario, la administracion de medicamentos, hasta la comunicacion con familias.

**Por que importa la transformacion digital?**

En el cuidado de adultos mayores, cada minuto cuenta. Los sistemas manuales — papeles, carpetas, notas adhesivas — generan errores, retrasos y riesgos para los residentes. Zendity elimina estos problemas al digitalizar cada proceso critico:

- **Trazabilidad**: Cada accion queda registrada con fecha, hora y responsable
- **Acceso inmediato**: La informacion del residente esta disponible en tiempo real desde cualquier dispositivo
- **Coordinacion**: Todos los departamentos trabajan sobre la misma plataforma unificada
- **Cumplimiento regulatorio**: HIPAA y regulaciones locales integradas en cada modulo

**Concepto clave: La Sede**

En Zendity, cada facilidad opera como una "Sede" (tenant). Una Sede es un espacio digital aislado y seguro donde toda la informacion de esa facilidad — residentes, empleados, horarios, medicamentos — vive completamente separada de otras facilidades. Esto garantiza que los datos de tu Sede nunca se mezclan con los de otra organizacion.

PREGUNTAS:
P: Cual es el proposito principal de Zendity?
a) Servir como red social para familias de adultos mayores
*b) Gestionar integralmente las operaciones de facilidades de cuido de adultos mayores
c) Procesar pagos y facturacion medica exclusivamente
d) Ofrecer servicios de telemedicina remota
EXPLICACION: Zendity es una plataforma de gestion integral que centraliza todas las operaciones de facilidades de senior living: clinicas, administrativas y de comunicacion.

P: Que ventaja ofrece la trazabilidad en Zendity?
a) Permite eliminar los turnos de trabajo
*b) Cada accion queda registrada con fecha, hora y responsable
c) Reduce automaticamente los costos de medicamentos
d) Elimina la necesidad de supervision clinica
EXPLICACION: La trazabilidad significa que cada accion (administrar un medicamento, cambiar un horario, registrar una nota) queda documentada con quien lo hizo y cuando.

P: Que es una "Sede" en el contexto de Zendity?
a) La oficina central de la empresa Zendity
*b) Un espacio digital aislado donde opera cada facilidad de cuido independientemente
c) El area fisica donde se atienden los residentes
d) Un grupo de empleados asignados al mismo turno
EXPLICACION: Una Sede (tenant) es un espacio digital aislado para cada facilidad. Garantiza que los datos de una facilidad nunca se mezclan con los de otra.

P: Cual de estos problemas resuelve la digitalizacion con Zendity?
a) La necesidad de contratar mas personal
b) La eliminacion total de enfermedades
*c) Los errores y retrasos causados por sistemas manuales de papel
d) La reduccion automatica de residentes en la facilidad
EXPLICACION: Los sistemas manuales (papeles, carpetas, notas) generan errores humanos y retrasos. Zendity digitaliza estos procesos para reducir riesgos y mejorar la eficiencia.

P: Que garantiza el modelo de Sede aislada en Zendity?
a) Que todos los empleados comparten la misma contrasena
b) Que la plataforma funciona sin internet
*c) Que los datos de una facilidad nunca se mezclan con los de otra
d) Que los residentes pueden ver datos de otras facilidades
EXPLICACION: El modelo multi-tenant asegura aislamiento completo de datos entre facilidades, protegiendo la privacidad y cumplimiento regulatorio.

---SECCION_2---
LECTURA:
# Roles y Permisos del Sistema

Zendity utiliza un sistema de roles para controlar que puede ver y hacer cada usuario dentro de la plataforma. Esto es fundamental para la seguridad y el cumplimiento de HIPAA.

**Roles Administrativos:**
- **ADMIN**: Acceso total a la Sede. Puede gestionar empleados, configurar modulos, ver reportes financieros y modificar cualquier dato. Solo los directores de la facilidad deben tener este rol.
- **DIRECTOR**: Similar al ADMIN pero enfocado en operaciones diarias. Tiene acceso a reportes, gestion de personal y supervision clinica.
- **SUPERVISOR**: Coordina equipos de trabajo. Puede ver dashboards de rendimiento, asignar turnos y aprobar cambios operativos.

**Roles Clinicos:**
- **NURSE (Enfermera)**: Acceso al modulo clinico completo. Puede registrar notas medicas, administrar medicamentos via eMAR y revisar historiales.
- **CAREGIVER (Cuidador)**: Acceso limitado al piso de cuido. Puede registrar actividades diarias, signos vitales basicos y notas de observacion.
- **THERAPIST**: Acceso a evaluaciones terapeuticas y planes de tratamiento.
- **SOCIAL_WORKER**: Acceso a planes de vida y coordinacion familiar.

**Roles de Soporte:**
- **MAINTENANCE, KITCHEN, CLEANING**: Acceso a sus modulos especificos de operaciones sin ver datos clinicos de residentes.
- **FAMILY**: Portal externo para familiares con acceso limitado al estado de su residente.
- **INVESTOR**: Vista de reportes financieros sin acceso a datos clinicos.

> **Regla de oro**: Cada rol solo ve lo que necesita para hacer su trabajo. Esto no es una limitacion — es proteccion para ti y para los residentes.

PREGUNTAS:
P: Quien deberia tener el rol de ADMIN en una facilidad?
a) Todos los empleados para facilitar el trabajo
b) Los cuidadores del turno de noche
*c) Solo los directores o administradores de la facilidad
d) Los familiares de los residentes
EXPLICACION: El rol ADMIN otorga acceso total a la Sede. Solo debe asignarse a directores o administradores que necesiten gestionar toda la operacion.

P: Que puede hacer un CAREGIVER en Zendity?
a) Modificar la configuracion de la Sede
*b) Registrar actividades diarias y observaciones en el piso de cuido
c) Aprobar reportes financieros
d) Gestionar los turnos de todo el personal
EXPLICACION: Los cuidadores tienen acceso al piso de cuido donde registran actividades diarias, signos vitales y notas de observacion de los residentes.

P: Por que un empleado de KITCHEN no puede ver datos clinicos de residentes?
a) Porque Zendity tiene un error de programacion
b) Porque los datos clinicos no existen en el sistema
*c) Porque el sistema de roles limita el acceso a lo necesario para cada funcion, protegiendo la privacidad
d) Porque el personal de cocina no tiene cuenta en el sistema
EXPLICACION: El principio de "minimo privilegio" significa que cada rol solo tiene acceso a la informacion necesaria para su funcion, cumpliendo con HIPAA y protegiendo la privacidad del residente.

P: Que rol tiene acceso al portal externo de Zendity?
a) ADMIN
b) SUPERVISOR
c) NURSE
*d) FAMILY
EXPLICACION: El rol FAMILY es para familiares de residentes. Tienen acceso a un portal externo con informacion limitada sobre el estado de su ser querido.

P: Cual es la "regla de oro" del sistema de roles?
a) Todos deben compartir el mismo nivel de acceso
*b) Cada rol solo ve lo que necesita para hacer su trabajo
c) Los supervisores deben tener acceso a todo
d) Los roles se pueden cambiar libremente entre empleados
EXPLICACION: La regla de oro es el principio de minimo privilegio: cada usuario solo accede a lo necesario para su funcion, protegiendo datos sensibles.

---SECCION_3---
LECTURA:
# Navegacion del Sistema

Zendity tiene dos espacios de trabajo principales, cada uno con su propio diseno visual para que siempre sepas donde estas:

**Corporate HQ (Sede Corporativa)** — Sidebar oscuro
Este es el espacio administrativo. Aqui los roles ADMIN, DIRECTOR y SUPERVISOR acceden a:
- **Pacientes/Residentes**: Expediente completo, admisiones, altas
- **Empleados (HR)**: Gestion de personal, horarios, evaluaciones
- **CRM**: Pipeline de prospectos y admisiones nuevas
- **Academy**: Cursos de capacitacion y certificaciones
- **Reportes**: Dashboards de rendimiento y cumplimiento

**Care Floor (Piso de Cuido)** — Sidebar blanco
Este es el espacio clinico diario. Los roles NURSE y CAREGIVER acceden a:
- **Dashboard de residentes**: Vista de todos los residentes activos con su grupo de color
- **Notas clinicas**: Registro de observaciones y eventos
- **eMAR**: Administracion electronica de medicamentos
- **Rondas**: Registro de rondas de supervision
- **Alertas**: Notificaciones de eventos criticos

**Grupos de Color**:
Los residentes se organizan en grupos de color (Rojo, Amarillo, Verde, Azul) para facilitar la asignacion de cuidadores y la coordinacion de turnos. Cada cuidador es responsable de su grupo asignado.

**Navegacion movil**:
En tablets y celulares, el sidebar se colapsa automaticamente. Usa el boton de hamburguesa (tres lineas horizontales) para abrir el menu de navegacion. En escritorio, el sidebar esta siempre visible.

PREGUNTAS:
P: Como se distingue visualmente el espacio Corporate HQ del Care Floor?
a) Ambos tienen el mismo diseno
*b) Corporate HQ tiene sidebar oscuro y Care Floor tiene sidebar blanco
c) Corporate HQ es solo para celulares y Care Floor para computadoras
d) Se distinguen por el tamano de la letra
EXPLICACION: Corporate HQ usa un sidebar de color oscuro (dark mode) y Care Floor usa sidebar blanco, para que el usuario siempre sepa en que espacio esta trabajando.

P: Que modulo usaria un Supervisor para ver el rendimiento del personal?
a) eMAR
b) CRM
c) Care Floor Dashboard
*d) Reportes en Corporate HQ
EXPLICACION: Los dashboards de rendimiento y cumplimiento estan en el modulo de Reportes dentro de Corporate HQ, accesible para roles ADMIN, DIRECTOR y SUPERVISOR.

P: Para que sirven los grupos de color en el piso de cuido?
a) Para decorar la interfaz del sistema
*b) Para organizar residentes y asignar cuidadores por grupo
c) Para indicar el nivel de gravedad de cada residente
d) Para clasificar los tipos de medicamentos
EXPLICACION: Los grupos de color (Rojo, Amarillo, Verde, Azul) organizan a los residentes y facilitan la asignacion de cuidadores, asegurando que cada cuidador sabe exactamente de cuales residentes es responsable.

P: Como se accede al menu de navegacion en un dispositivo movil?
a) El menu no esta disponible en dispositivos moviles
b) Deslizando el dedo hacia la derecha en la pantalla
*c) Presionando el boton de hamburguesa (tres lineas horizontales)
d) Haciendo doble tap en la esquina superior
EXPLICACION: En tablets y celulares, el sidebar se colapsa y aparece un boton de hamburguesa que, al presionarlo, abre el menu completo de navegacion.

P: Que modulo es exclusivo del espacio Care Floor?
a) CRM
b) Academy
*c) eMAR (administracion de medicamentos)
d) Gestion de empleados
EXPLICACION: El eMAR (Electronic Medication Administration Record) es un modulo clinico del piso de cuido donde enfermeras registran la administracion de medicamentos en tiempo real.

---SECCION_4---
LECTURA:
# Seguridad y Autenticacion

La seguridad en Zendity es critica porque maneja informacion medica protegida por la ley HIPAA (Health Insurance Portability and Accountability Act). Cada empleado es responsable de proteger su acceso.

**Sistema de PIN**:
Zendity utiliza un sistema de autenticacion basado en PIN personal. Tu PIN es unico e intransferible. Funciona como tu firma digital: todo lo que hagas en el sistema queda registrado bajo tu identidad.

**Reglas fundamentales del PIN:**
1. **Nunca compartas tu PIN** con nadie, ni siquiera con tu supervisor
2. **Nunca uses el PIN de otro** empleado, incluso si te lo ofrecen
3. **Reporta inmediatamente** si crees que alguien conoce tu PIN
4. Si olvidas tu PIN, contacta al administrador — nunca intentes adivinar el de otro

**Sesiones y Timeout**:
Tu sesion en Zendity tiene una duracion maxima de 8 horas. Despues de ese tiempo, el sistema cierra tu sesion automaticamente y deberas ingresar tu PIN nuevamente. Esto previene acceso no autorizado si dejas un dispositivo desatendido.

**HIPAA y tu responsabilidad**:
HIPAA protege la informacion de salud de los residentes. Como empleado de una facilidad de cuido, tienes la obligacion legal de:
- No acceder a informacion de residentes que no estan bajo tu cuidado
- No compartir datos clinicos fuera de la plataforma (capturas de pantalla, fotos, mensajes)
- No dejar sesiones abiertas en dispositivos compartidos
- Reportar cualquier violacion de privacidad que observes

> **Importante**: Una violacion de HIPAA puede resultar en multas de hasta $50,000 por incidente y consecuencias legales para ti y la facilidad.

PREGUNTAS:
P: Como funciona el PIN en Zendity?
a) Es una contrasena compartida por todo el equipo del turno
*b) Es un codigo personal unico que sirve como firma digital de cada empleado
c) Es un codigo que cambia cada hora automaticamente
d) Es opcional y solo se usa para acceder a reportes financieros
EXPLICACION: El PIN es personal, unico e intransferible. Todo lo registrado en el sistema queda vinculado al PIN del empleado que realizo la accion, funcionando como firma digital.

P: Que debes hacer si un companero te pide tu PIN?
a) Darselo si es una emergencia
b) Darselo solo si es tu supervisor
*c) Negarte y explicar que el PIN es personal e intransferible
d) Compartirlo pero pedirle que no lo use mas de una vez
EXPLICACION: El PIN nunca debe compartirse con nadie, independientemente del motivo. Si un companero necesita acceso, debe usar su propio PIN o contactar al administrador.

P: Cuanto dura una sesion activa en Zendity?
a) 24 horas
b) Indefinidamente hasta que cierres sesion
*c) Maximo 8 horas antes de cerrarse automaticamente
d) 30 minutos
EXPLICACION: Las sesiones tienen un timeout automatico de 8 horas para prevenir acceso no autorizado en caso de que un dispositivo quede desatendido.

P: Cual de estas acciones constituye una violacion de HIPAA?
a) Registrar un medicamento usando tu propio PIN
b) Consultar el expediente de un residente bajo tu cuidado
*c) Tomar una captura de pantalla del historial clinico y enviarla por mensaje
d) Cerrar sesion al terminar tu turno
EXPLICACION: Compartir datos clinicos fuera de la plataforma (capturas, fotos, mensajes) es una violacion directa de HIPAA que puede resultar en multas y consecuencias legales.

P: Que debes hacer si sospechas que alguien conoce tu PIN?
a) Ignorarlo si no ha pasado nada malo
b) Cambiar tu turno de trabajo
*c) Reportarlo inmediatamente al administrador
d) Crear una cuenta nueva en el sistema
EXPLICACION: Cualquier sospecha de compromiso del PIN debe reportarse inmediatamente al administrador para que lo cambie y se investigue si hubo acceso no autorizado.

---SECCION_5---
LECTURA:
# Buenas Practicas y Soporte

Para aprovechar Zendity al maximo y mantener la seguridad de los datos, sigue estas practicas diarias:

**Al iniciar tu turno:**
1. Inicia sesion con TU PIN personal
2. Verifica que estas en el espacio correcto (Corporate HQ o Care Floor)
3. Revisa las notificaciones y alertas pendientes
4. Confirma tu grupo de color asignado (si aplica)

**Durante tu turno:**
- Registra eventos en tiempo real — no al final del turno. La documentacion tardia pierde valor clinico
- Si ves algo inusual en un residente, documentalo inmediatamente en las notas clinicas
- Usa el sistema de alertas para situaciones urgentes en lugar de buscar a alguien verbalmente
- Nunca dejes un dispositivo con sesion abierta sin supervision

**Al terminar tu turno:**
1. Asegurate de que todas tus notas y registros estan completos
2. Cierra sesion en todos los dispositivos que usaste
3. No te lleves informacion clinica fuera del sistema

**Cuando contactar soporte tecnico:**
- Tu PIN no funciona o fue comprometido
- Ves datos incorrectos en el expediente de un residente
- El sistema muestra errores o no carga correctamente
- Necesitas acceso a un modulo que no aparece en tu menu

**Reportar problemas:**
Si detectas un error en el sistema o una situacion que compromete la seguridad de los datos, reportalo al administrador de tu Sede. No intentes "arreglarlo" por tu cuenta modificando datos que no te corresponden.

> **Recuerda**: Zendity es una herramienta que te ayuda a dar mejor cuidado. La tecnologia complementa tu experticia — nunca la reemplaza.

PREGUNTAS:
P: Cuando debes registrar un evento clinico en Zendity?
a) Al final del turno, cuando tengas tiempo
b) Solo si el supervisor te lo pide
*c) En tiempo real, en el momento que ocurre
d) Una vez a la semana en un reporte resumen
EXPLICACION: La documentacion en tiempo real es critica porque preserva la precision clinica. Registrar eventos al final del turno aumenta el riesgo de errores y omisiones.

P: Que debes hacer al terminar tu turno?
a) Dejar la sesion abierta para el proximo turno
*b) Completar tus registros y cerrar sesion en todos los dispositivos
c) Compartir tu PIN con el empleado del turno entrante
d) Desinstalar la aplicacion del dispositivo
EXPLICACION: Al terminar el turno debes asegurarte de que todos tus registros esten completos y cerrar sesion en cada dispositivo usado para prevenir acceso no autorizado.

P: En cual de estas situaciones debes contactar al soporte tecnico?
a) Cuando quieras cambiar el color de tu grupo
b) Cuando un residente no quiera comer
*c) Cuando tu PIN no funciona o crees que fue comprometido
d) Cuando termines tu turno antes de tiempo
EXPLICACION: Problemas con el PIN, errores del sistema o acceso comprometido son situaciones que requieren atencion inmediata del soporte tecnico o el administrador.

P: Que debes hacer si ves datos incorrectos en el expediente de un residente?
a) Corregirlos tu mismo inmediatamente
b) Ignorarlos si no afectan tu trabajo
*c) Reportarlo al administrador de la Sede sin modificar datos que no te corresponden
d) Borrar el expediente y crear uno nuevo
EXPLICACION: Si detectas datos incorrectos, debes reportarlo al administrador. Modificar datos que no te corresponden puede causar mas errores y violar protocolos de trazabilidad.

P: Que complementa la tecnologia de Zendity segun las buenas practicas?
a) Reemplaza completamente la necesidad de personal capacitado
b) Elimina la responsabilidad legal del empleado
*c) Complementa la experticia del profesional de cuido sin reemplazarla
d) Automatiza todas las decisiones clinicas
EXPLICACION: Zendity es una herramienta que complementa tu experticia profesional. La tecnologia ayuda a organizar, documentar y coordinar, pero las decisiones clinicas siguen dependiendo del juicio profesional.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 2: PROCESO DE ADMISION
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ADMISION_101',
    title: 'Proceso de Admision en Zendity',
    description: 'Domina el flujo completo de admision: desde el primer contacto en el CRM hasta la creacion del expediente, Plan de Vida y portal familiar.',
    durationMins: 30,
    bonusCompliance: 100,
    emoji: '📋',
    content: `---META---
TITULO: Proceso de Admision en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende el flujo completo de admision desde el CRM hasta la creacion automatizada del expediente. Debe demostrar conocimiento de cada etapa del pipeline y que datos son criticos.
TERMINOS_CLAVE: CRM, pipeline, admision, IntakeData, Plan de Vida, portal familiar, PROSPECT, CONTACTED, EVALUATION, ADMISSION, residente, documentacion
PREGUNTA_REFLEXION: Describe paso a paso que sucede en Zendity desde que una familia contacta tu facilidad por primera vez hasta que el residente esta completamente admitido. Que rol juega tu departamento en este proceso y como aseguras que no se pierda informacion critica en la transicion?

---SECCION_1---
LECTURA:
# El Pipeline de Admision (CRM)

El CRM (Customer Relationship Management) de Zendity es el punto de entrada de cada nuevo residente. Antes de que alguien se convierta en residente, pasa por un pipeline estructurado que asegura que toda la informacion necesaria se recopila de forma ordenada.

**Las 4 etapas del Pipeline:**

1. **PROSPECT (Prospecto)**: La familia o representante legal hace el primer contacto. Se registra nombre, telefono, email y notas iniciales. En esta etapa solo tenemos datos basicos de contacto.

2. **CONTACTED (Contactado)**: El equipo de admisiones ha respondido al prospecto. Se ha tenido al menos una conversacion inicial donde se explican los servicios, costos y requisitos. Se documentan las necesidades del potencial residente.

3. **EVALUATION (Evaluacion)**: Se agenda una visita o evaluacion formal. El equipo clinico evalua si la facilidad puede atender las necesidades especificas del potencial residente. Se revisan condiciones medicas, nivel de dependencia y requerimientos especiales.

4. **ADMISSION (Admision)**: La familia acepta y se procede con la admision formal. Aqui Zendity ejecuta una transaccion automatizada que crea todos los registros necesarios del nuevo residente.

> **Dato clave**: Cuando un lead se mueve a ADMISSION, Zendity automaticamente crea el expediente del paciente, el Plan de Vida en borrador, los datos de intake para enfermeria, y la cuenta del familiar representante.

PREGUNTAS:
P: Cual es la primera etapa del pipeline de admision en el CRM?
*a) PROSPECT — registro de datos basicos de contacto
b) EVALUATION — evaluacion clinica formal
c) ADMISSION — creacion del expediente
d) CONTACTED — primera conversacion con la familia
EXPLICACION: PROSPECT es la primera etapa donde se registran los datos basicos de contacto de la familia o representante que hace el primer acercamiento.

P: Que sucede automaticamente cuando un lead se mueve a la etapa ADMISSION?
a) Se envia un email al prospecto solamente
b) Se elimina el registro del CRM
*c) Se crea el expediente del paciente, Plan de Vida, IntakeData y cuenta familiar
d) Se asigna automaticamente un cuidador
EXPLICACION: Al mover un lead a ADMISSION, Zendity ejecuta una transaccion automatizada que crea el expediente completo del nuevo residente, incluyendo Plan de Vida en borrador, datos de intake y portal familiar.

P: En la etapa EVALUATION, quien participa principalmente?
a) Solo el equipo administrativo
b) Solo la familia del prospecto
*c) El equipo clinico que evalua si la facilidad puede atender las necesidades del potencial residente
d) Solo el director de la facilidad
EXPLICACION: En EVALUATION, el equipo clinico evalua condiciones medicas, nivel de dependencia y requerimientos especiales para determinar si la facilidad puede atender adecuadamente al potencial residente.

P: Que informacion se recopila en la etapa CONTACTED?
a) Solo el nombre del prospecto
b) Los resultados de laboratorio del potencial residente
*c) Necesidades del potencial residente tras una conversacion inicial sobre servicios y requisitos
d) La asignacion de grupo de color
EXPLICACION: En CONTACTED, el equipo ha tenido al menos una conversacion donde se explican servicios, costos y requisitos, y se documentan las necesidades especificas del potencial residente.

P: Cuantas etapas tiene el pipeline de admision en el CRM de Zendity?
a) 2 etapas
b) 3 etapas
*c) 4 etapas
d) 6 etapas
EXPLICACION: El pipeline tiene 4 etapas: PROSPECT, CONTACTED, EVALUATION y ADMISSION, cada una representando un avance en el proceso de admision.

---SECCION_2---
LECTURA:
# Documentacion Requerida para la Admision

Cuando un prospecto avanza en el pipeline, es critico recopilar documentacion completa y precisa. La documentacion incompleta retrasa la admision y puede poner en riesgo la seguridad del residente.

**Datos esenciales del Lead (CRM):**
- **Nombre completo** del potencial residente (nombre y apellido son obligatorios)
- **Email** del representante o familiar principal
- **Telefono** de contacto directo
- **Notas** sobre la situacion: por que buscan cuido, condiciones principales, urgencia

**Documentacion clinica requerida:**
- Historial medico reciente (diagnosticos activos, cirugias previas)
- Lista de medicamentos actuales (nombre, dosis, frecuencia, via de administracion)
- Alergias conocidas (medicamentos, alimentos, ambientales)
- Ordenes medicas vigentes del medico tratante
- Resultados de laboratorio recientes

**Documentacion legal:**
- Identificacion del residente
- Identificacion del representante legal / familiar autorizado
- Poder notarial o tutela legal (si aplica)
- Autorizacion de tratamiento firmada
- Consentimiento informado para uso del portal digital

**Regla importante:** Nunca admitas a un residente sin verificar que la documentacion minima esta completa. Es mejor retrasar una admision un dia que admitir sin la informacion critica para su cuidado seguro.

PREGUNTAS:
P: Cuales son los campos obligatorios al crear un lead en el CRM?
a) Solo el email
b) Nombre, email, telefono y diagnosticos
*c) Nombre y apellido del potencial residente
d) Direccion fisica y numero de seguro social
EXPLICACION: Al crear un lead en el CRM, los campos obligatorios son nombre y apellido. Email, telefono y notas son importantes pero no bloquean la creacion del registro.

P: Por que es critico completar la lista de medicamentos antes de la admision?
a) Para calcular el costo de la estadia
b) Para asignar el grupo de color correcto
*c) Para garantizar la continuidad del tratamiento y prevenir errores de medicacion
d) Para generar automaticamente el Plan de Vida
EXPLICACION: La lista completa de medicamentos es esencial para que enfermeria pueda continuar el tratamiento sin interrupcion y prevenir errores como dosis incorrectas o interacciones peligrosas.

P: Que pasa si se admite a un residente sin documentacion clinica completa?
a) El sistema automaticamente completa la informacion faltante
*b) Se pone en riesgo la seguridad del residente por falta de informacion critica
c) No pasa nada, la documentacion se puede completar en cualquier momento
d) El residente es dado de alta automaticamente
EXPLICACION: Admitir sin documentacion clinica completa pone en riesgo directo al residente. El equipo de cuido necesita conocer diagnosticos, medicamentos y alergias para dar atencion segura.

P: Que tipo de consentimiento se necesita para usar el portal digital familiar?
a) No se necesita ningun consentimiento
b) Solo una llamada telefonica de confirmacion
*c) Consentimiento informado firmado para uso del portal digital
d) Autorizacion verbal del residente unicamente
EXPLICACION: El uso del portal digital requiere consentimiento informado firmado, cumpliendo con regulaciones de privacidad y proteccion de datos.

P: Cual es la regla sobre admitir sin documentacion minima completa?
a) Se puede admitir y completar la documentacion durante la primera semana
*b) Nunca se debe admitir sin verificar que la documentacion minima esta completa
c) Solo se necesita la documentacion si el residente tiene condiciones criticas
d) La documentacion es opcional si la familia firma una exencion
EXPLICACION: La regla es clara: nunca admitir sin documentacion minima completa. Es preferible retrasar la admision que comprometer la seguridad del residente.

---SECCION_3---
LECTURA:
# IntakeData y Evaluacion de Enfermeria

Cuando un lead se convierte en residente (etapa ADMISSION), Zendity crea automaticamente un registro de IntakeData con status PENDING. Este registro es la responsabilidad del equipo de enfermeria.

**Que es IntakeData?**

IntakeData es el formulario de evaluacion inicial de enfermeria. Contiene toda la informacion clinica que el equipo necesita para comenzar a cuidar al residente de forma segura. Es como el "checklist de entrada" clinico.

**Campos criticos del IntakeData:**

- **Historial Medico**: Condiciones cronicas, cirugias previas, hospitalizaciones recientes
- **Diagnosticos**: Lista de diagnosticos activos que guiaran el plan de cuidado
- **Medicamentos**: Lista completa con nombre, dosis, frecuencia y via. Este campo alimenta directamente el eMAR
- **Status del Intake**: Indica en que punto esta la evaluacion

**Flujo del IntakeData:**
1. **PENDING**: Creado automaticamente con la admision. Enfermeria debe completar la evaluacion
2. **IN_REVIEW**: La enfermera ha completado la evaluacion y esta pendiente de revision por el supervisor o director
3. **APPROVED**: La evaluacion ha sido aprobada y el residente esta listo para recibir cuidado completo

**Responsabilidad de enfermeria:**
La enfermera asignada debe completar el IntakeData dentro de las primeras 24 horas de la admision. Esto incluye verificar cara a cara cada medicamento, cada diagnostico, y documentar cualquier hallazgo nuevo durante la evaluacion presencial.

> **Atencion**: El campo de medicamentos en IntakeData alimenta directamente el eMAR. Si los medicamentos no estan correctos aqui, estaran incorrectos en la administracion.

PREGUNTAS:
P: Que status tiene el IntakeData cuando se crea automaticamente con la admision?
*a) PENDING — pendiente de evaluacion por enfermeria
b) APPROVED — aprobado y listo para uso
c) IN_REVIEW — en revision por el supervisor
d) COMPLETED — completado automaticamente con los datos del CRM
EXPLICACION: El IntakeData se crea con status PENDING, indicando que enfermeria debe completar la evaluacion inicial del nuevo residente.

P: Dentro de cuanto tiempo debe enfermeria completar el IntakeData?
a) Dentro de la primera semana
b) Dentro de las primeras 48 horas
*c) Dentro de las primeras 24 horas de la admision
d) No tiene limite de tiempo
EXPLICACION: La evaluacion de intake debe completarse dentro de las primeras 24 horas para asegurar que el equipo de cuido tiene toda la informacion critica para atender al residente de forma segura.

P: Que sistema alimenta directamente el campo de medicamentos del IntakeData?
a) El CRM
b) El Plan de Vida
c) Los reportes financieros
*d) El eMAR (administracion electronica de medicamentos)
EXPLICACION: Los medicamentos registrados en IntakeData alimentan directamente el eMAR. Si los medicamentos estan incorrectos en el intake, la administracion de medicamentos tendra errores.

P: Que debe verificar la enfermera durante la evaluacion presencial del intake?
a) Solo los datos financieros del residente
b) Solo las preferencias alimentarias
*c) Cada medicamento, diagnostico, y documentar hallazgos nuevos cara a cara
d) Solo el numero de habitacion asignada
EXPLICACION: La enfermera debe verificar presencialmente cada medicamento y diagnostico del residente, y documentar cualquier hallazgo nuevo que no estuviera en la documentacion previa.

P: Cual es el flujo correcto de status del IntakeData?
a) APPROVED → IN_REVIEW → PENDING
b) PENDING → APPROVED → IN_REVIEW
*c) PENDING → IN_REVIEW → APPROVED
d) IN_REVIEW → PENDING → APPROVED
EXPLICACION: El flujo es PENDING (creado automaticamente) → IN_REVIEW (completado por enfermeria, pendiente de revision) → APPROVED (aprobado por supervisor/director).

---SECCION_4---
LECTURA:
# Plan de Vida (LifePlan)

El Plan de Vida es el documento mas importante en el cuidado a largo plazo de un residente. Define los objetivos, preferencias y estrategias de cuidado personalizadas para cada individuo.

**Que es un Plan de Vida?**

A diferencia de un plan medico tradicional que solo se enfoca en enfermedades, el Plan de Vida es un enfoque integral que abarca:
- Salud fisica y manejo de condiciones cronicas
- Bienestar emocional y social
- Actividades recreativas y preferencias personales
- Metas de rehabilitacion (si aplica)
- Preferencias alimentarias y culturales
- Necesidades espirituales o religiosas

**Flujo del Plan de Vida:**
1. **DRAFT (Borrador)**: Se crea automaticamente con la admision. Es un documento vacio que debe ser completado por el equipo interdisciplinario.
2. **IN_PROGRESS (En progreso)**: El equipo esta trabajando activamente en definir los objetivos y estrategias. Participan enfermeria, trabajo social, terapia y la familia.
3. **ACTIVE (Activo)**: El plan ha sido aprobado y esta guiando el cuidado diario del residente. Se revisa periodicamente.

**Quien participa en el Plan de Vida?**
- **Trabajo Social**: Coordina el proceso y asegura que las preferencias del residente estan reflejadas
- **Enfermeria**: Aporta los objetivos clinicos y de medicacion
- **Terapia**: Define metas de rehabilitacion y actividad
- **Familia**: Comparte preferencias, historia de vida y expectativas
- **El residente**: Siempre que sea posible, su voz es la mas importante

> **Principio fundamental**: El Plan de Vida no es un formulario que se llena una vez. Es un documento vivo que evoluciona con el residente.

PREGUNTAS:
P: Que diferencia al Plan de Vida de un plan medico tradicional?
a) El Plan de Vida solo cubre medicamentos
*b) El Plan de Vida es integral: abarca salud, bienestar emocional, actividades, preferencias y metas personales
c) El Plan de Vida es mas corto y simple
d) El Plan de Vida lo crea unicamente el medico
EXPLICACION: El Plan de Vida va mas alla de lo medico. Incluye bienestar emocional, actividades recreativas, preferencias culturales, metas de rehabilitacion y necesidades espirituales del residente.

P: Con que status se crea el Plan de Vida al admitir un residente?
a) ACTIVE — activo y listo para guiar el cuidado
b) IN_PROGRESS — en proceso de definicion
*c) DRAFT — borrador vacio pendiente de completar
d) PENDING — pendiente de aprobacion
EXPLICACION: El Plan de Vida se crea como DRAFT (borrador) automaticamente con la admision, indicando que el equipo interdisciplinario debe completarlo.

P: Cual es la voz mas importante en la creacion del Plan de Vida?
a) La del director de la facilidad
b) La del equipo de enfermeria exclusivamente
c) La del familiar que paga la estadia
*d) La del residente, siempre que sea posible
EXPLICACION: Aunque todo el equipo interdisciplinario y la familia participan, la voz del residente es la mas importante porque el plan debe reflejar sus preferencias, valores y metas personales.

P: Que rol coordina el proceso del Plan de Vida?
*a) Trabajo Social
b) Enfermeria
c) Administracion
d) Mantenimiento
EXPLICACION: Trabajo Social coordina el proceso del Plan de Vida, asegurando que las voces de todos los participantes (residente, familia, equipo clinico) estan reflejadas en el documento.

P: Con que frecuencia debe revisarse el Plan de Vida?
a) Solo al momento de la admision
b) Una vez al ano
c) Solo cuando la familia lo solicita
*d) Periodicamente, porque es un documento vivo que evoluciona con el residente
EXPLICACION: El Plan de Vida es un documento vivo que debe revisarse periodicamente para adaptarse a cambios en la salud, preferencias y metas del residente.

---SECCION_5---
LECTURA:
# Portal Familiar

Zendity incluye un portal dedicado para los familiares de los residentes. Este portal permite que las familias se mantengan informadas y conectadas con el cuidado de su ser querido.

**Creacion automatica de la cuenta familiar:**

Cuando un lead se mueve a ADMISSION en el CRM, Zendity automaticamente crea una cuenta de FamilyMember usando el email del lead. Esta cuenta tiene:
- **Nombre**: "Representante General (CRM)" — debe actualizarse con el nombre real
- **Passcode**: Un codigo inicial "123456" que el familiar debe cambiar en su primer acceso
- **Nivel de acceso**: "Full" — acceso completo a la informacion de su residente

**Que puede ver la familia en el portal?**
- Estado general del residente (activo, hospitalizado, etc.)
- Notas de cuidado y eventos importantes
- Actividades del dia y participacion
- Comunicacion directa con el equipo de la facilidad
- Fotos y actualizaciones del Wall (muro social)

**Que NO puede ver la familia:**
- Datos de otros residentes
- Informacion interna del personal
- Notas clinicas detalladas (a menos que el equipo lo autorice)
- Configuracion administrativa de la Sede

**Seguridad del portal familiar:**
- Cada cuenta esta vinculada a un residente especifico
- El passcode inicial DEBE cambiarse en el primer acceso
- La familia solo accede via un portal separado, no desde el sistema interno
- El administrador puede desactivar una cuenta familiar en cualquier momento

> **Responsabilidad**: Asegurate de informar a la familia que deben cambiar su passcode "123456" inmediatamente. Usar el codigo por defecto es un riesgo de seguridad.

PREGUNTAS:
P: Cuando se crea automaticamente la cuenta del familiar en Zendity?
a) Cuando la familia llama por primera vez
*b) Cuando el lead se mueve a la etapa ADMISSION en el CRM
c) Cuando el residente completa su primera semana
d) Cuando la enfermera completa el IntakeData
EXPLICACION: La cuenta familiar se crea automaticamente como parte de la transaccion de admision, cuando el lead pasa a status ADMISSION en el CRM.

P: Cual es el passcode inicial de una cuenta familiar nueva?
a) El numero de telefono del familiar
b) Una clave aleatoria generada por el sistema
*c) "123456" — un codigo por defecto que debe cambiarse inmediatamente
d) No tiene passcode, el acceso es libre
EXPLICACION: El passcode inicial por defecto es "123456". Es responsabilidad del equipo informar a la familia que deben cambiarlo inmediatamente por seguridad.

P: Que informacion NO puede ver la familia a traves del portal?
a) El estado general de su residente
b) Las actividades del dia
*c) Datos de otros residentes e informacion interna del personal
d) Las fotos del muro social (Wall)
EXPLICACION: El portal familiar esta aislado: la familia solo ve informacion de su residente. No tiene acceso a datos de otros residentes, informacion del personal ni configuracion administrativa.

P: Que debe hacer el equipo al crear una cuenta familiar?
a) Darle acceso total al sistema interno
b) Compartir las credenciales por mensaje de texto
*c) Informar a la familia que debe cambiar el passcode por defecto inmediatamente
d) Crear la cuenta sin notificar a la familia
EXPLICACION: El equipo debe informar a la familia que su passcode inicial es un codigo temporal que debe cambiarse inmediatamente para proteger la privacidad del residente.

P: Desde donde accede la familia a su portal?
a) Desde el mismo sistema interno que usan los empleados
*b) Desde un portal separado exclusivo para familiares
c) Desde la aplicacion de mensajeria del celular
d) No tienen acceso digital, todo es presencial
EXPLICACION: Las familias acceden a traves de un portal separado, completamente aislado del sistema interno que usan los empleados, garantizando seguridad y privacidad.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 3: eMAR - REGISTRO ELECTRONICO DE MEDICAMENTOS
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'EMAR_101',
    title: 'eMAR: Administracion Electronica de Medicamentos',
    description: 'Domina el proceso de administracion segura de medicamentos usando el sistema eMAR de Zendity, desde el registro hasta la auditoria.',
    durationMins: 35,
    bonusCompliance: 125,
    emoji: '💊',
    content: `---META---
TITULO: eMAR - Administracion Electronica de Medicamentos
PROMPT_ZENDI: Evalua si el empleado comprende el flujo completo de administracion de medicamentos en el eMAR, los protocolos de seguridad (verificacion, documentacion, excepciones) y puede describir como manejar situaciones comunes como rechazos o dosis omitidas.
TERMINOS_CLAVE: eMAR, administracion, verificacion, dosis, PRN, medicamento, documentacion, rechazo, omision, auditoria, los 5 correctos, registro en tiempo real
PREGUNTA_REFLEXION: Un residente se niega a tomar su medicamento programado de la manana. Describe exactamente los pasos que seguirias: como lo documentas en el eMAR, a quien notificas, y que precauciones tomas para asegurar la seguridad del residente. Se especifico.

---SECCION_1---
LECTURA:
# Que es eMAR y Por Que Importa

**eMAR** (Electronic Medication Administration Record) es el sistema digital de Zendity para registrar y rastrear la administracion de medicamentos a cada residente. Reemplaza las hojas de papel tradicionales donde se marcaban los medicamentos dados.

**Por que es critico el eMAR?**

Los errores de medicacion son una de las principales causas de eventos adversos en facilidades de cuido de adultos mayores. Las causas mas comunes son:
- Dar el medicamento equivocado
- Dar la dosis incorrecta
- Dar el medicamento a la hora equivocada
- Olvidar dar un medicamento programado
- Dar un medicamento al residente equivocado

El eMAR reduce estos errores al:
- **Programar automaticamente** los horarios de cada medicamento
- **Alertar en tiempo real** cuando una dosis esta pendiente o atrasada
- **Registrar cada administracion** con fecha, hora y quien la realizo
- **Prevenir duplicados** al mostrar si un medicamento ya fue administrado

**Los 5 Correctos de la administracion:**
Antes de administrar cualquier medicamento, verifica siempre:
1. **Residente correcto** — Confirma la identidad del residente
2. **Medicamento correcto** — Verifica el nombre del medicamento
3. **Dosis correcta** — Confirma la cantidad prescrita
4. **Via correcta** — Oral, topica, inyectable, etc.
5. **Hora correcta** — Dentro de la ventana de administracion programada

> **Recuerda**: El eMAR es tu aliado, pero no reemplaza tu juicio profesional. Si algo no se ve bien, detenlo y verifica.

PREGUNTAS:
P: Cual es la funcion principal del eMAR?
a) Calcular el costo de los medicamentos
*b) Registrar y rastrear la administracion de medicamentos a cada residente de forma digital
c) Ordenar medicamentos automaticamente a la farmacia
d) Reemplazar las recetas medicas del doctor
EXPLICACION: El eMAR es el sistema digital para registrar y rastrear cada administracion de medicamentos, reemplazando las hojas de papel tradicionales y reduciendo errores.

P: Cual de los siguientes NO es uno de los "5 Correctos" de la administracion de medicamentos?
a) Residente correcto
b) Medicamento correcto
*c) Farmacia correcta
d) Dosis correcta
EXPLICACION: Los 5 Correctos son: residente correcto, medicamento correcto, dosis correcta, via correcta y hora correcta. "Farmacia correcta" no forma parte de este protocolo.

P: Como previene el eMAR la administracion duplicada de un medicamento?
a) Bloqueando el acceso al modulo despues de cada dosis
b) Enviando un email al supervisor automaticamente
*c) Mostrando si un medicamento ya fue administrado, previniendo que se registre dos veces
d) Eliminando el medicamento de la lista despues de administrarlo
EXPLICACION: El eMAR muestra el estado de cada medicamento en tiempo real. Si una dosis ya fue administrada, aparece marcada, previniendo que otro miembro del equipo la administre de nuevo.

P: Que debes hacer si algo no "se ve bien" con un medicamento antes de administrarlo?
a) Administrarlo de todas formas y notificar despues
b) Pedirle a otro cuidador que lo administre
*c) Detener la administracion y verificar antes de proceder
d) Documentar tu preocupacion y seguir con el siguiente medicamento
EXPLICACION: Ante cualquier duda sobre un medicamento, debes detener la administracion y verificar. El juicio profesional siempre tiene prioridad sobre seguir una rutina.

P: Cual es una de las principales causas de errores de medicacion que el eMAR ayuda a prevenir?
a) Que el residente no quiera tomar el medicamento
*b) Olvidar administrar un medicamento programado
c) Que la farmacia envie el medicamento equivocado
d) Que el medico cambie la receta sin aviso
EXPLICACION: El eMAR previene omisiones al alertar en tiempo real cuando una dosis esta pendiente o atrasada, asegurando que ningun medicamento programado se olvide.

---SECCION_2---
LECTURA:
# Registro de Medicamentos en el Sistema

Antes de que un medicamento aparezca en el eMAR de un residente, debe ser registrado correctamente en el sistema. Este registro generalmente proviene del IntakeData (para nuevos residentes) o de ordenes medicas posteriores.

**Informacion requerida por cada medicamento:**
- **Nombre del medicamento** (nombre generico y comercial si aplica)
- **Dosis**: Cantidad exacta (ej: 500mg, 10ml, 2 tabletas)
- **Frecuencia**: Cada cuantas horas o cuantas veces al dia (ej: cada 8 horas, 3 veces al dia, una vez al acostarse)
- **Via de administracion**: Oral, sublingual, topica, intramuscular, intravenosa, rectal, oftalmica, etc.
- **Horarios programados**: Las horas exactas en que debe administrarse (ej: 6:00 AM, 2:00 PM, 10:00 PM)
- **Instrucciones especiales**: Con alimentos, en ayunas, con agua completa, etc.

**Tipos de medicamentos:**

1. **Medicamentos Programados (Scheduled)**: Se administran a horas fijas del dia, todos los dias. Ejemplo: Metformina 500mg oral cada 12 horas.

2. **Medicamentos PRN (Pro Re Nata / Segun Necesidad)**: Se administran solo cuando el residente presenta un sintoma especifico. Ejemplo: Acetaminofen 500mg oral PRN para dolor. Requieren documentar el motivo de administracion.

3. **Medicamentos de Orden Unica (One-Time)**: Se administran una sola vez por orden medica especifica. Ejemplo: Antibiotico pre-procedimiento.

**Alergias y contraindicaciones:**
El sistema muestra las alergias del residente de forma prominente. Si un medicamento nuevo coincide con una alergia registrada, el sistema genera una alerta que debe ser revisada antes de proceder.

PREGUNTAS:
P: De donde proviene inicialmente la lista de medicamentos de un nuevo residente en el eMAR?
a) De la farmacia directamente
*b) Del IntakeData completado por enfermeria durante la admision
c) De la familia del residente
d) Del modulo de reportes financieros
EXPLICACION: La lista de medicamentos iniciales se registra en el IntakeData durante la evaluacion de enfermeria en la admision, y esta alimenta directamente el eMAR.

P: Que diferencia a un medicamento PRN de un medicamento programado?
a) Los PRN son mas caros
b) Los PRN solo los puede administrar el doctor
*c) Los PRN se administran solo cuando el residente presenta un sintoma especifico, no a horas fijas
d) Los PRN no requieren documentacion
EXPLICACION: Los medicamentos PRN (Pro Re Nata) se administran segun necesidad cuando el residente presenta un sintoma especifico (dolor, fiebre, ansiedad), a diferencia de los programados que tienen horarios fijos.

P: Que informacion adicional se requiere al administrar un medicamento PRN?
a) El costo del medicamento
*b) El motivo de administracion (que sintoma presenta el residente)
c) La autorizacion verbal de la familia
d) La aprobacion del director
EXPLICACION: Al administrar un PRN, se debe documentar el motivo (ej: "residente reporta dolor de cabeza nivel 6/10") porque la administracion debe justificarse clinicamente.

P: Que sucede si se registra un medicamento nuevo que coincide con una alergia del residente?
a) El sistema lo administra automaticamente con precaucion
b) El medicamento se elimina del sistema automaticamente
*c) El sistema genera una alerta que debe ser revisada antes de proceder
d) No pasa nada, las alergias son solo informativas
EXPLICACION: El sistema genera una alerta de alergia que el equipo clinico debe revisar. Esta alerta es un mecanismo de seguridad critico para prevenir reacciones adversas.

P: Cuales son los tres tipos de medicamentos que maneja el eMAR?
a) Genericos, comerciales y experimentales
b) Urgentes, normales y opcionales
*c) Programados (scheduled), PRN (segun necesidad) y de orden unica (one-time)
d) Orales, inyectables y topicos
EXPLICACION: El eMAR maneja tres tipos: programados (horarios fijos), PRN (segun necesidad del residente) y de orden unica (una sola administracion por orden medica).

---SECCION_3---
LECTURA:
# Proceso de Administracion de Dosis

El momento de administrar un medicamento es el punto mas critico del proceso. Cada paso debe seguirse rigurosamente para garantizar la seguridad del residente.

**Flujo de administracion paso a paso:**

**Paso 1: Identificar al residente**
Antes de dar cualquier medicamento, confirma que estas con el residente correcto. Usa al menos dos identificadores: nombre completo y otro dato como habitacion o foto en el sistema.

**Paso 2: Revisar el eMAR**
Abre el eMAR del residente y revisa:
- Que medicamentos estan programados para esta hora
- Si alguno ya fue administrado (evitar duplicados)
- Si hay alertas o instrucciones especiales
- Si hay alergias activas

**Paso 3: Preparar el medicamento**
Verifica los 5 Correctos: residente, medicamento, dosis, via y hora. Lee la etiqueta del medicamento tres veces: al tomarlo del almacen, al prepararlo, y al momento de administrar.

**Paso 4: Administrar**
Entrega el medicamento al residente. Observa que efectivamente lo tome (para medicamentos orales). Algunos residentes pueden esconder tabletas en la boca — verifica discretamente.

**Paso 5: Registrar inmediatamente**
Documenta la administracion en el eMAR **inmediatamente** despues de darla. Nunca registres antes de administrar ("pre-charting") ni mucho despues. El registro debe incluir la hora exacta.

**Paso 6: Observar**
Permanece atento a cualquier reaccion adversa inmediata: dificultad para tragar, cambio de color, nauseas, etc.

> **Regla critica**: NUNCA hagas "pre-charting" (registrar antes de dar el medicamento). Si el residente rechaza el medicamento despues de que lo registraste como dado, el registro sera falso.

PREGUNTAS:
P: Cuantas veces debes leer la etiqueta del medicamento durante la preparacion?
a) Una vez es suficiente
b) Dos veces: al tomarlo y al darlo
*c) Tres veces: al tomarlo del almacen, al prepararlo, y al administrar
d) No es necesario si ya conoces el medicamento
EXPLICACION: La regla de las tres lecturas es un protocolo de seguridad estandar: leer la etiqueta al tomar el medicamento, al prepararlo, y al momento de administrarlo al residente.

P: Que es "pre-charting" y por que esta prohibido?
a) Es registrar medicamentos en la noche anterior y es permitido en emergencias
*b) Es registrar un medicamento como administrado ANTES de darlo realmente, y esta prohibido porque el registro seria falso si el residente lo rechaza
c) Es preparar los medicamentos del dia anterior y es una practica recomendada
d) Es verificar el chart del residente antes de administrar
EXPLICACION: Pre-charting significa registrar una administracion antes de que ocurra. Si el residente rechaza el medicamento despues, el registro seria falso. Siempre se registra inmediatamente DESPUES de administrar.

P: Que debes verificar en el eMAR ANTES de administrar un medicamento?
a) Solo el nombre del medicamento
b) Solo si hay alergias activas
*c) Medicamentos programados para la hora, si alguno ya fue administrado, alertas, instrucciones especiales y alergias
d) Solo el numero de habitacion del residente
EXPLICACION: Antes de administrar, debes revisar todos los medicamentos programados, verificar que no haya duplicados, revisar alertas, instrucciones especiales y alergias activas.

P: Que debes hacer despues de entregar un medicamento oral al residente?
a) Retirarte inmediatamente a atender al siguiente residente
*b) Observar que el residente efectivamente lo trague y verificar que no lo esconda
c) Registrar la administracion al final del turno
d) Pedirle al residente que firme un recibo
EXPLICACION: Algunos residentes pueden esconder tabletas en la boca. Es importante verificar discretamente que el medicamento fue tragado antes de registrar la administracion.

P: Cuando exactamente debes registrar la administracion en el eMAR?
a) Al inicio del turno, anticipando las dosis del dia
b) Al final del turno, una vez terminada toda la ronda
*c) Inmediatamente despues de administrar el medicamento al residente
d) Cuando el supervisor lo solicite
EXPLICACION: El registro debe hacerse inmediatamente despues de la administracion, con la hora exacta. Registrar antes (pre-charting) o mucho despues compromete la precision y legalidad del registro.

---SECCION_4---
LECTURA:
# Alertas y Excepciones

No toda administracion de medicamentos sale segun lo planeado. El eMAR de Zendity tiene mecanismos para documentar correctamente las situaciones excepcionales.

**Dosis Omitida (Missed Dose):**
Ocurre cuando un medicamento programado no se administra dentro de su ventana de tiempo. Causas comunes:
- El residente estaba en una cita medica fuera de la facilidad
- El residente estaba dormido y el medicamento no era urgente
- Error del personal (olvido)

Documentacion requerida: Seleccionar "Dosis Omitida" en el eMAR, indicar la razon, y notificar al supervisor. Si la omision fue por error, se activa un protocolo de seguimiento.

**Rechazo del Residente (Refused):**
El residente tiene derecho a rechazar cualquier medicamento. Cuando esto ocurre:
1. Intenta educadamente explicar la importancia del medicamento
2. Si sigue rechazando, respeta su decision
3. Documenta el rechazo en el eMAR con el motivo (si el residente lo expresa)
4. Notifica a enfermeria o al supervisor
5. Si es un medicamento critico (ej: insulina, antihipertensivo), notifica al medico

**Administracion Tardia (Late Administration):**
Si un medicamento se administra fuera de su ventana programada:
- Registra la hora real de administracion (no la hora programada)
- Documenta la razon del retraso
- Evalua si el retraso puede afectar la siguiente dosis

**Reaccion Adversa:**
Si observas una reaccion despues de administrar:
1. Atiende al residente inmediatamente
2. Notifica a enfermeria / medico
3. Documenta la reaccion en el eMAR y en las notas clinicas
4. No administres la siguiente dosis hasta que el medico lo autorice

> **Importante**: Documentar correctamente las excepciones protege al residente, a ti y a la facilidad. Nunca "maquilles" un registro para que parezca que todo salio bien.

PREGUNTAS:
P: Que derecho tiene el residente respecto a sus medicamentos?
a) Solo puede rechazar medicamentos no esenciales
b) No tiene derecho a rechazar ningun medicamento
*c) Tiene derecho a rechazar cualquier medicamento
d) Solo puede rechazar si la familia lo autoriza
EXPLICACION: El residente tiene el derecho autonomo de rechazar cualquier medicamento. El personal debe respetar esta decision, documentarla y notificar al equipo clinico.

P: Que debes hacer si un residente rechaza un medicamento critico como insulina?
a) Obligar al residente a tomarlo
b) Documentar el rechazo y no hacer nada mas
*c) Documentar el rechazo, notificar al supervisor y al medico por ser medicamento critico
d) Administrar el medicamento en la siguiente comida sin que el residente se de cuenta
EXPLICACION: Ante el rechazo de un medicamento critico, ademas de documentar y notificar al supervisor, se debe notificar al medico porque la omision de medicamentos como insulina puede tener consecuencias serias.

P: Si administras un medicamento tarde, que hora debes registrar en el eMAR?
a) La hora originalmente programada para que no se vea como error
*b) La hora real de administracion con documentacion de la razon del retraso
c) No registrarlo para evitar problemas
d) La hora del siguiente turno
EXPLICACION: Siempre se registra la hora real de administracion, nunca la hora programada. Falsificar la hora es una violacion de protocolos de documentacion y puede poner en riesgo al residente.

P: Que es lo primero que debes hacer si observas una reaccion adversa a un medicamento?
*a) Atender al residente inmediatamente
b) Documentar la reaccion en el eMAR
c) Llamar a la familia
d) Investigar si el medicamento estaba vencido
EXPLICACION: La prioridad absoluta es la atencion inmediata al residente. La documentacion y notificaciones son importantes pero vienen despues de asegurar que el residente esta estable.

P: Por que es importante documentar correctamente las excepciones en el eMAR?
a) Solo para cumplir con los requisitos del sistema
b) Para que el turno siguiente no tenga que investigar
*c) Porque protege al residente, al empleado y a la facilidad legalmente
d) Para que el supervisor pueda hacer reportes
EXPLICACION: La documentacion correcta de excepciones (omisiones, rechazos, retrasos, reacciones) es proteccion legal para todos. Registros falsos o incompletos pueden tener consecuencias legales y clinicas.

---SECCION_5---
LECTURA:
# Reportes y Auditoria

El eMAR no solo es una herramienta de administracion diaria — tambien genera datos valiosos para la supervision, auditoria y mejora continua de la calidad del cuidado.

**Reportes disponibles:**
- **Reporte de cumplimiento**: Muestra el porcentaje de dosis administradas a tiempo vs. omitidas o tardias
- **Reporte de PRN**: Frecuencia de uso de medicamentos PRN, util para detectar patrones (ej: un residente que necesita analgesicos PRN cada dia puede necesitar un ajuste en su prescripcion)
- **Reporte de excepciones**: Lista todos los rechazos, omisiones y administraciones tardias con sus razones
- **Historial por residente**: Cronologia completa de todas las administraciones de un residente

**Auditoria y trazabilidad:**
Cada registro en el eMAR incluye:
- Quien administro el medicamento (vinculado al PIN del empleado)
- Fecha y hora exacta de la administracion
- Que medicamento, dosis y via se uso
- Si hubo alguna excepcion y cual fue la razon

Esta trazabilidad es fundamental durante inspecciones regulatorias. Los auditores pueden verificar que cada dosis fue administrada correctamente, por quien, y a que hora.

**Mejora continua:**
Los supervisores y directores deben revisar los reportes del eMAR regularmente para:
- Identificar patrones de omision o retraso (puede indicar falta de personal o problemas de turno)
- Detectar uso excesivo de PRN (puede indicar que un residente necesita ajuste en su plan de medicacion)
- Verificar cumplimiento general del equipo
- Prepararse para auditorias regulatorias

**Tu rol en la auditoria:**
Como empleado, tu contribucion a una auditoria exitosa es simple: **documenta correctamente, en tiempo real, cada vez.** Si cada administracion se registra con precision, la auditoria no es motivo de estres.

> **Dato clave**: Un eMAR bien documentado puede ser la diferencia entre pasar una inspeccion regulatoria y recibir una citacion. Tu registro es evidencia legal.

PREGUNTAS:
P: Que puede indicar el uso excesivo de medicamentos PRN en un residente?
a) Que el residente es dificil de manejar
b) Que la farmacia envio demasiados medicamentos
*c) Que el residente puede necesitar un ajuste en su plan de medicacion regular
d) Que el eMAR tiene un error de programacion
EXPLICACION: Si un residente necesita PRN frecuentemente para el mismo sintoma, puede indicar que su medicacion programada no es suficiente y necesita revision medica para ajustar el plan.

P: Que informacion incluye cada registro del eMAR para efectos de auditoria?
a) Solo el nombre del medicamento y la fecha
*b) Quien administro (PIN), fecha y hora exacta, medicamento, dosis, via y cualquier excepcion
c) Solo si el residente acepto o rechazo el medicamento
d) Solo el turno en que se administro
EXPLICACION: Cada registro del eMAR incluye trazabilidad completa: quien (vinculado al PIN), cuando (fecha y hora exacta), que (medicamento, dosis, via) y cualquier excepcion documentada.

P: Que pueden indicar los patrones de omision o retraso en los reportes del eMAR?
a) Que los medicamentos son muy caros
*b) Falta de personal o problemas en la organizacion de turnos
c) Que los residentes no cooperan
d) Que el sistema tiene errores frecuentes
EXPLICACION: Los patrones de omision o retraso pueden indicar problemas operativos como falta de personal, turnos mal organizados o sobrecarga de trabajo, informacion valiosa para los supervisores.

P: Cual es tu contribucion mas importante para una auditoria exitosa del eMAR?
a) Memorizar los nombres de todos los medicamentos
b) Revisar los reportes del mes anterior
*c) Documentar correctamente en tiempo real cada administracion y excepcion
d) Preparar un informe especial el dia de la auditoria
EXPLICACION: La mejor preparacion para una auditoria es la practica diaria de documentacion correcta y en tiempo real. Si cada registro es preciso, la auditoria es simplemente una verificacion de tus buenas practicas.

P: Por que se dice que el registro del eMAR es "evidencia legal"?
a) Porque solo lo puede leer un abogado
b) Porque requiere firma notarizada
*c) Porque documenta quien hizo que, cuando y como, y puede usarse en procedimientos legales o regulatorios
d) Porque esta encriptado con tecnologia militar
EXPLICACION: Cada registro del eMAR es evidencia legal porque documenta con precision quien administro que medicamento, a que hora, y bajo que circunstancias. Esta evidencia puede ser usada en inspecciones regulatorias o procedimientos legales.
`
}

,

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 4: PROCESO DE CIERRE DE TURNO
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'CIERRE_TURNO_101',
    title: 'Proceso de Cierre de Turno',
    description: 'Aprende a cerrar tu turno correctamente en Zendity: pre-scan, resolucion de pendientes y firma electronica.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🔒',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: Proceso de Cierre de Turno
PROMPT_ZENDI: Evalua si el empleado comprende el proceso completo de cierre de turno, incluyendo pre-scan, resolucion de blockers y warnings, y la importancia de no dejar sesiones zombi.
TERMINOS_CLAVE: pre-scan, Blocker, Warning, Override Forzado, Quick Resolution, OMITIDO, TRANSFERIDO, RECHAZADO, firma electronica, sesion zombi, HIPAA
PREGUNTA_REFLEXION: Tu turno termino. El pre-scan detecta 2 medicamentos MISSED y una tarea INMINENTE sin resolver. Tienes 10 minutos para salir. Como cierras el turno correctamente en Zendity?

---SECCION_1---
LECTURA:
# Que es el cierre de turno y por que importa

El cierre de turno en Zendity no es simplemente apagar la tableta y marcharte. Es un proceso estructurado que garantiza la continuidad del cuidado entre turnos. Cada turno acumula tareas completadas, medicamentos administrados, incidentes documentados y pendientes sin resolver. Si un cuidador se va sin cerrar formalmente, toda esa informacion queda en un estado ambiguo que pone en riesgo al residente.

Zendity implementa un flujo de cierre obligatorio que incluye tres fases: el pre-scan automatico, la resolucion de pendientes criticos y la firma electronica. Este proceso protege tanto al residente como al cuidador, ya que genera un registro auditable de que se reviso todo antes de transferir responsabilidad. Ademas, cumple con los requisitos de documentacion de HIPAA y las regulaciones locales de Puerto Rico para facilidades de cuidado prolongado. Un cierre incompleto puede derivar en hallazgos durante auditorias regulatorias y, lo mas importante, en brechas de cuidado que afectan directamente al residente.

PREGUNTAS:
P: Cual es el proposito principal del cierre de turno en Zendity?
a) Apagar la tableta para ahorrar bateria
*b) Garantizar la continuidad del cuidado mediante un proceso estructurado y auditable
c) Enviar un mensaje al supervisor de que ya te vas
d) Generar estadisticas de productividad del cuidador
EXPLICACION: El cierre de turno garantiza que toda la informacion del turno quede documentada y que no haya brechas de cuidado al transferir responsabilidad al siguiente turno.

P: Cuantas fases incluye el flujo de cierre de turno en Zendity?
a) Dos: revision y firma
b) Una: la firma electronica
*c) Tres: pre-scan automatico, resolucion de pendientes y firma electronica
d) Cuatro: revision, resolucion, firma y reporte
EXPLICACION: El flujo de cierre tiene tres fases claramente definidas: el pre-scan automatico que detecta pendientes, la resolucion de esos pendientes y la firma electronica que certifica el cierre.

P: Que sucede si un cuidador se va sin cerrar formalmente su turno?
a) Zendity cierra el turno automaticamente despues de 15 minutos
*b) La informacion queda en estado ambiguo, poniendo en riesgo al residente
c) El siguiente cuidador recibe una notificacion y puede cerrar por el
d) No pasa nada, el sistema guarda todo automaticamente
EXPLICACION: Sin un cierre formal, las tareas y medicamentos quedan en estado ambiguo, lo que puede causar brechas de cuidado y problemas durante auditorias.

P: Que regulacion de privacidad se relaciona directamente con el proceso de cierre de turno?
*a) HIPAA
b) OSHA
c) FDA
d) ADA
EXPLICACION: HIPAA requiere documentacion adecuada del manejo de informacion de salud, y el cierre de turno genera registros auditables que cumplen con estos requisitos.

P: Un cierre de turno incompleto puede resultar en:
a) Solo una advertencia menor en el sistema
b) Un correo automatico al cuidador
*c) Hallazgos en auditorias regulatorias y brechas de cuidado
d) La eliminacion automatica de las tareas pendientes
EXPLICACION: Un cierre incompleto tiene consecuencias serias: puede generar hallazgos negativos en auditorias y, mas importante, puede causar brechas en el cuidado del residente.

---SECCION_2---
LECTURA:
# El Pre-Scan automatico

Cuando un cuidador inicia el proceso de cierre de turno en Zendity, lo primero que ocurre es el pre-scan automatico. Este escaneo revisa en tiempo real todas las tareas, medicamentos y eventos asociados a ese turno y genera un reporte instantaneo de pendientes. El pre-scan clasifica cada pendiente en dos categorias: Blockers y Warnings.

Los Blockers son elementos criticos que impiden el cierre del turno hasta que se resuelvan. Ejemplos incluyen medicamentos con estado MISSED sin justificacion y tareas de seguridad marcadas como INMINENTE. Los Warnings son elementos importantes pero que permiten continuar el cierre con una justificacion documentada. El pre-scan muestra un resumen visual con iconos rojos para Blockers y amarillos para Warnings, facilitando la priorizacion. Este paso es completamente automatico y no puede ser omitido ni desactivado por el cuidador. La unica forma de avanzar es resolver o documentar cada elemento detectado. El sistema registra la hora exacta del pre-scan para fines de auditoria.

PREGUNTAS:
P: Que es lo primero que ocurre cuando un cuidador inicia el cierre de turno?
a) Se envia una notificacion al supervisor
b) Se bloquea la tableta hasta que llegue el relevo
*c) Se ejecuta el pre-scan automatico de pendientes
d) Se genera la firma electronica
EXPLICACION: El pre-scan automatico es siempre el primer paso del cierre de turno, revisando todas las tareas y medicamentos del turno en tiempo real.

P: Como clasifica el pre-scan los pendientes detectados?
*a) En Blockers (criticos, impiden cierre) y Warnings (importantes, permiten continuar con justificacion)
b) En Urgentes y No Urgentes
c) En Completados y Pendientes
d) En Rojos, Amarillos y Verdes
EXPLICACION: El pre-scan usa dos categorias: Blockers que impiden el cierre hasta resolverse, y Warnings que permiten continuar si se documenta una justificacion.

P: Cual de estos es un ejemplo de Blocker?
a) Una nota de enfermeria sin revisar
*b) Un medicamento MISSED sin justificacion
c) Un mensaje del supervisor sin leer
d) Una tarea completada sin comentario adicional
EXPLICACION: Los medicamentos con estado MISSED sin justificacion son Blockers porque representan un riesgo directo para el residente y deben resolverse antes del cierre.

P: Puede un cuidador omitir o desactivar el pre-scan?
a) Si, con autorizacion del supervisor
b) Si, si no tiene pendientes visibles
c) Si, en turnos nocturnos cuando hay menos actividad
*d) No, el pre-scan es obligatorio y no puede omitirse
EXPLICACION: El pre-scan es completamente automatico y obligatorio. Ningun usuario puede omitirlo ni desactivarlo, garantizando que siempre se revisen los pendientes.

P: Para que registra el sistema la hora exacta del pre-scan?
a) Para calcular el tiempo extra del cuidador
b) Para enviar recordatorios al turno entrante
*c) Para fines de auditoria
d) Para medir la velocidad del sistema
EXPLICACION: La hora exacta del pre-scan se registra como parte del registro auditable del cierre de turno, cumpliendo con requisitos regulatorios.

---SECCION_3---
LECTURA:
# Blockers vs Warnings

Entender la diferencia entre Blockers y Warnings es fundamental para un cierre de turno eficiente. Los Blockers son pendientes que representan un riesgo inmediato para el residente o una violacion de protocolo critica. Zendity no permite avanzar al siguiente paso del cierre mientras exista un Blocker sin resolver. Ejemplos tipicos incluyen: medicamentos controlados con estado MISSED, tareas de seguridad INMINENTE sin completar y alertas de caida sin documentar.

Los Warnings, por otro lado, son pendientes importantes que deben atenderse pero que no impiden el cierre si se documenta una justificacion valida. Ejemplos incluyen: notas de enfermeria incompletas, tareas de limpieza pendientes y observaciones de cocina sin registrar. Un Warning se puede resolver de tres formas: completando la tarea, transfiriendola al siguiente turno con estado TRANSFERIDO, o marcandola como OMITIDO con justificacion escrita. Es importante recordar que acumular muchos Warnings puede activar una alerta al supervisor, y un patron repetitivo de Warnings similares puede convertirse en un hallazgo durante evaluaciones de desempeno.

PREGUNTAS:
P: Que define a un Blocker en el cierre de turno?
a) Cualquier tarea que no se completo durante el turno
b) Una nota del supervisor que requiere respuesta
*c) Un pendiente que representa riesgo inmediato o violacion critica de protocolo
d) Una tarea que lleva mas de 2 horas sin completarse
EXPLICACION: Los Blockers son especificamente pendientes que representan riesgo inmediato para el residente o violaciones criticas de protocolo, por eso impiden el cierre del turno.

P: Cual de las siguientes es una forma valida de resolver un Warning?
a) Ignorarlo y continuar con el cierre
b) Pedir al turno entrante que lo borre
*c) Transferirlo al siguiente turno con estado TRANSFERIDO
d) Reiniciar la aplicacion para que desaparezca
EXPLICACION: Los Warnings se pueden resolver completando la tarea, transfiriendola con estado TRANSFERIDO, o marcandola como OMITIDO con justificacion. Nunca se ignoran ni se borran.

P: Que sucede si un cuidador acumula muchos Warnings repetidamente?
a) El sistema elimina automaticamente los Warnings antiguos
b) Los Warnings se convierten automaticamente en Blockers
*c) Se activa una alerta al supervisor y puede afectar evaluaciones de desempeno
d) El cuidador pierde acceso temporal al sistema
EXPLICACION: Un patron repetitivo de Warnings similares genera alertas al supervisor y puede convertirse en hallazgo durante evaluaciones de desempeno.

P: Cual es un ejemplo de un Blocker tipico?
a) Una nota de enfermeria incompleta
b) Una observacion de cocina sin registrar
*c) Un medicamento controlado con estado MISSED
d) Una tarea de limpieza pendiente
EXPLICACION: Los medicamentos controlados con estado MISSED son Blockers porque representan un riesgo directo e inmediato para la salud del residente.

P: Que estado se asigna a un Warning que se decide no completar pero se justifica?
a) RECHAZADO
b) TRANSFERIDO
*c) OMITIDO
d) CANCELADO
EXPLICACION: Cuando un Warning no se va a completar, se marca como OMITIDO y se requiere una justificacion escrita explicando por que no se realizo la tarea.

---SECCION_4---
LECTURA:
# Quick Resolution y Override Forzado

Zendity ofrece dos mecanismos para resolver pendientes durante el cierre de turno: Quick Resolution y Override Forzado. Quick Resolution es la opcion preferida y mas utilizada. Permite al cuidador resolver rapidamente un pendiente desde la misma pantalla del pre-scan sin tener que navegar a otras secciones. Por ejemplo, si un medicamento aparece como MISSED, Quick Resolution permite agregar la justificacion directamente, cambiar el estado a RECHAZADO si el residente lo rechazo, o documentar que se administro tarde.

Override Forzado es un mecanismo de emergencia reservado para situaciones excepcionales donde un Blocker no puede resolverse por la via normal. Requiere autorizacion del supervisor mediante un codigo temporal y genera una alerta automatica al administrador de la facilidad. El Override Forzado deja un registro especial en el sistema marcado en rojo, y cada uso es revisado en la proxima auditoria. Este mecanismo existe porque la realidad operativa a veces presenta situaciones imprevistas, pero su uso frecuente indica un problema sistematico que debe investigarse. El cuidador debe documentar detalladamente la razon del override.

PREGUNTAS:
P: Cual es la diferencia principal entre Quick Resolution y Override Forzado?
*a) Quick Resolution es para uso diario normal; Override Forzado es un mecanismo de emergencia que requiere autorizacion
b) Quick Resolution es mas rapido; Override Forzado es mas lento pero mas seguro
c) Quick Resolution es para Warnings; Override Forzado es para Blockers
d) No hay diferencia, son dos nombres para el mismo proceso
EXPLICACION: Quick Resolution es el metodo preferido para resolver pendientes de forma normal, mientras que Override Forzado es exclusivamente para emergencias y requiere autorizacion del supervisor.

P: Que se necesita para ejecutar un Override Forzado?
a) La aprobacion del residente o familiar
b) Esperar 30 minutos para que el sistema lo permita
*c) Un codigo temporal de autorizacion del supervisor
d) La firma electronica de dos cuidadores
EXPLICACION: El Override Forzado requiere un codigo temporal proporcionado por el supervisor, asegurando que haya supervision en el uso de este mecanismo de emergencia.

P: Que genera automaticamente el sistema cuando se usa un Override Forzado?
a) Un correo al familiar del residente
*b) Una alerta al administrador de la facilidad
c) Un reporte a las autoridades regulatorias
d) Una suspension temporal del cuidador
EXPLICACION: Cada Override Forzado genera automaticamente una alerta al administrador de la facilidad y queda marcado en rojo para revision en la proxima auditoria.

P: Mediante Quick Resolution, que opciones tiene un cuidador para un medicamento MISSED?
a) Solo puede eliminarlo del registro
b) Solo puede transferirlo al siguiente turno
*c) Agregar justificacion, cambiar a RECHAZADO si aplica, o documentar administracion tardia
d) Solo puede contactar al medico para cancelar la orden
EXPLICACION: Quick Resolution permite varias opciones contextuales: justificar el MISSED, cambiar el estado a RECHAZADO si el residente lo rechazo, o documentar que se administro fuera del horario establecido.

P: Que indica el uso frecuente de Override Forzado en una facilidad?
a) Que los cuidadores son eficientes resolviendo emergencias
b) Que el sistema tiene errores tecnicos frecuentes
*c) Que existe un problema sistematico que debe investigarse
d) Que la facilidad tiene residentes de alta complejidad
EXPLICACION: El uso frecuente de Override Forzado no es normal y senala un problema sistematico subyacente, ya sea en la planificacion de turnos, en la capacitacion o en los recursos disponibles.

---SECCION_5---
LECTURA:
# Firma electronica y sesion zombi

Una vez resueltos todos los Blockers y documentados los Warnings, el cuidador procede a la firma electronica. Esta firma es el acto final del cierre de turno y certifica que el cuidador reviso todos los pendientes y asume responsabilidad por las acciones documentadas durante su turno. En Zendity, la firma electronica utiliza el PIN personal del cuidador combinado con verificacion biometrica cuando el dispositivo lo permite. La firma tiene validez legal segun las regulaciones de Puerto Rico.

Si un cuidador abandona la sesion sin completar la firma electronica, se genera lo que Zendity denomina una sesion zombi. Una sesion zombi es un turno que quedo abierto sin cierre formal, lo cual representa un riesgo serio de seguridad y compliance. El sistema detecta sesiones zombi automaticamente y notifica al supervisor inmediatamente. Las sesiones zombi pueden causar conflictos de datos cuando el turno entrante intenta registrar actividades, ya que dos sesiones activas simultaneas para la misma zona generan inconsistencias. El supervisor debe cerrar manualmente la sesion zombi documentando la razon del abandono.

PREGUNTAS:
P: Que elementos componen la firma electronica en Zendity?
a) Nombre completo y fecha solamente
b) Huella digital unicamente
*c) PIN personal del cuidador combinado con verificacion biometrica cuando esta disponible
d) Correo electronico y contrasena del sistema
EXPLICACION: La firma electronica usa el PIN personal del cuidador y, cuando el dispositivo lo permite, verificacion biometrica adicional para mayor seguridad.

P: Que es una sesion zombi?
a) Una sesion que se cerro automaticamente por inactividad
*b) Un turno que quedo abierto sin cierre formal ni firma electronica
c) Una sesion duplicada creada por error del sistema
d) Un turno nocturno sin actividad registrada
EXPLICACION: Una sesion zombi ocurre cuando un cuidador abandona la sesion sin completar la firma electronica, dejando el turno abierto sin cierre formal.

P: Que problemas causa una sesion zombi?
a) Solo genera una notificacion menor al cuidador
b) Bloquea permanentemente el dispositivo
*c) Conflictos de datos cuando el turno entrante intenta registrar actividades
d) Elimina automaticamente los registros del turno abandonado
EXPLICACION: Las sesiones zombi causan conflictos porque dos sesiones activas simultaneas para la misma zona generan inconsistencias en los datos del sistema.

P: Quien es responsable de cerrar una sesion zombi?
a) El cuidador del turno entrante
b) El sistema la cierra automaticamente despues de 4 horas
*c) El supervisor, documentando la razon del abandono
d) El administrador de IT de la facilidad
EXPLICACION: El supervisor debe cerrar manualmente la sesion zombi y documentar la razon por la cual el cuidador no completo el cierre formal de su turno.

P: La firma electronica en Zendity tiene validez legal en Puerto Rico?
*a) Si, cumple con las regulaciones locales
b) No, es solo un registro interno del sistema
c) Solo si se imprime y se firma a mano tambien
d) Solo para medicamentos controlados
EXPLICACION: La firma electronica de Zendity tiene validez legal segun las regulaciones de Puerto Rico, lo que le da peso juridico al registro de cierre de turno.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 5: HANDOVER DE ENFERMERIA Y RELEVO DE TURNO
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'HANDOVER_101',
    title: 'Handover de Enfermeria y Relevo de Turno',
    description: 'Domina el proceso de handover entre turnos: comunicacion efectiva, documentacion y continuidad del cuidado.',
    durationMins: 30,
    bonusCompliance: 10,
    emoji: '🤝',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: Handover de Enfermeria y Relevo de Turno
PROMPT_ZENDI: Evalua si el empleado comprende los tipos de handover, la documentacion requerida y como manejar situaciones donde el turno saliente dejo pendientes criticos.
TERMINOS_CLAVE: handover presencial, handover virtual, Prologo del Turno, HANDOVER PENDIENTE, digest, turno nocturno, cuidador saliente, cuidador entrante, ZendiAssist, Override Forzado
PREGUNTA_REFLEXION: Eres cuidador vespertino. El turno diurno no documento 2 incidentes y un MISSED. El turno nocturno llega en 30 minutos. Que haces?

---SECCION_1---
LECTURA:
# Que es un handover y por que es critico

El handover es el proceso de transferencia de responsabilidad entre el cuidador saliente y el cuidador entrante al cambiar de turno. En el contexto de facilidades de cuidado prolongado en Puerto Rico, un handover deficiente es una de las causas principales de eventos adversos y errores de medicacion. Zendity estructura este proceso para minimizar el riesgo de perdida de informacion critica.

Un handover efectivo garantiza que el cuidador entrante conozca el estado actual de cada residente, los pendientes sin resolver, los cambios en ordenes medicas y cualquier incidente ocurrido durante el turno anterior. Sin esta transferencia, el nuevo cuidador opera a ciegas, tomando decisiones sin contexto completo. Zendity registra cada handover como un evento auditable, vinculando al cuidador saliente y entrante con timestamp exacto. El estado HANDOVER PENDIENTE se asigna automaticamente cuando un turno cierra sin que el siguiente turno haya confirmado recepcion, funcionando como alerta de que la cadena de comunicacion se rompio.

PREGUNTAS:
P: Que es un handover en el contexto de Zendity?
a) El proceso de reiniciar la tableta entre turnos
b) Un reporte que se envia al supervisor al final del dia
*c) La transferencia formal de responsabilidad entre cuidador saliente y entrante
d) La evaluacion de desempeno que hace el supervisor entre turnos
EXPLICACION: El handover es especificamente la transferencia formal de responsabilidad del cuidado entre el cuidador que termina su turno y el que lo inicia.

P: Cual es una de las causas principales de eventos adversos en facilidades de cuidado prolongado?
a) El uso excesivo de tecnologia
*b) Un handover deficiente
c) Turnos demasiado largos
d) La falta de personal administrativo
EXPLICACION: Los handovers deficientes son una causa reconocida de eventos adversos y errores de medicacion porque el cuidador entrante no recibe informacion critica sobre los residentes.

P: Que informacion debe incluir un handover efectivo?
a) Solo los medicamentos pendientes
b) Unicamente los incidentes graves
*c) Estado de residentes, pendientes, cambios en ordenes medicas e incidentes del turno
d) Solo las tareas que el cuidador saliente no completo
EXPLICACION: Un handover efectivo debe cubrir el panorama completo: estado actual de cada residente, pendientes sin resolver, cambios en ordenes y cualquier incidente ocurrido.

P: Que significa el estado HANDOVER PENDIENTE en Zendity?
a) Que el cuidador entrante aun no ha llegado a la facilidad
*b) Que un turno cerro sin que el siguiente turno confirmara recepcion de la informacion
c) Que el supervisor no ha aprobado el cambio de turno
d) Que hay tareas sin completar del turno anterior
EXPLICACION: HANDOVER PENDIENTE se activa automaticamente cuando el turno saliente cierra pero el entrante no ha confirmado que recibio la informacion, indicando una ruptura en la cadena de comunicacion.

P: Como registra Zendity cada handover?
a) Como una nota interna visible solo para el supervisor
b) Como un correo electronico automatico
*c) Como un evento auditable con cuidador saliente, entrante y timestamp exacto
d) Como un mensaje en el chat grupal de la facilidad
EXPLICACION: Cada handover queda registrado como evento auditable que vincula ambos cuidadores con la hora exacta, cumpliendo requisitos regulatorios de trazabilidad.

---SECCION_2---
LECTURA:
# Handover presencial vs virtual

Zendity soporta dos modalidades de handover: presencial y virtual. El handover presencial ocurre cuando ambos cuidadores coinciden fisicamente en la facilidad durante el cambio de turno. Es la modalidad preferida porque permite comunicacion directa, resolucion inmediata de dudas y verificacion conjunta del estado de los residentes. Durante el handover presencial, Zendity muestra una pantalla compartida donde ambos cuidadores pueden revisar juntos el resumen del turno.

El handover virtual se activa cuando el cuidador saliente no puede coincidir con el entrante, comun en turnos nocturnos o cuando hay cambios de ultimo momento. En esta modalidad, el cuidador saliente graba un resumen de audio o video a traves de Zendity, complementado con el digest automatico del sistema. El cuidador entrante debe revisar este material y confirmar recepcion antes de iniciar actividades. Aunque el handover virtual es menos ideal, Zendity lo compensa con herramientas adicionales como el digest detallado y alertas prioritarias. Ambas modalidades generan el mismo registro auditable y requieren confirmacion de recepcion por parte del cuidador entrante.

PREGUNTAS:
P: Cual es la modalidad de handover preferida en Zendity?
*a) Presencial, porque permite comunicacion directa y resolucion inmediata de dudas
b) Virtual, porque es mas rapido y eficiente
c) Ambas son igualmente preferidas
d) Depende de la cantidad de residentes asignados
EXPLICACION: El handover presencial es preferido porque permite interaccion directa entre cuidadores, resolucion inmediata de preguntas y verificacion conjunta del estado de los residentes.

P: En que situacion se activa tipicamente el handover virtual?
a) Cuando el supervisor lo ordena
b) Cuando la facilidad tiene pocas camas ocupadas
*c) Cuando el cuidador saliente no puede coincidir fisicamente con el entrante
d) Cuando el sistema detecta pocos pendientes
EXPLICACION: El handover virtual se usa cuando no hay coincidencia fisica entre cuidadores, situacion comun en turnos nocturnos o cambios de ultima hora.

P: Que debe hacer el cuidador entrante en un handover virtual antes de iniciar actividades?
a) Contactar al supervisor para recibir instrucciones
b) Esperar a que el sistema le asigne tareas automaticamente
*c) Revisar el material del cuidador saliente y confirmar recepcion
d) Llamar al cuidador saliente por telefono
EXPLICACION: En el handover virtual, el cuidador entrante debe revisar el resumen grabado y el digest del sistema, y confirmar recepcion antes de comenzar su turno.

P: Que herramienta compensa las limitaciones del handover virtual?
a) Una videollamada obligatoria con el supervisor
*b) El digest detallado generado automaticamente por el sistema
c) Un formulario impreso de resumen del turno
d) Un correo electronico automatico con todas las tareas
EXPLICACION: El digest automatico de Zendity proporciona un resumen detallado que compensa la falta de comunicacion directa en el handover virtual.

P: En cuanto a registros auditables, que diferencia hay entre handover presencial y virtual?
a) El presencial genera registro auditable pero el virtual no
b) El virtual genera registro mas detallado que el presencial
c) Ninguno genera registro auditable, eso lo hace el supervisor
*d) Ambas modalidades generan el mismo tipo de registro auditable
EXPLICACION: Independientemente de la modalidad, ambos tipos de handover generan el mismo registro auditable y requieren confirmacion de recepcion del cuidador entrante.

---SECCION_3---
LECTURA:
# El Prologo del Turno y ZendiAssist

Cuando el cuidador entrante confirma la recepcion del handover, Zendity genera automaticamente el Prologo del Turno. Este es un resumen inteligente creado por ZendiAssist que consolida toda la informacion relevante que el cuidador necesita para iniciar su turno con contexto completo. El Prologo incluye: estado actual de cada residente asignado, medicamentos proximos a administrar, pendientes transferidos del turno anterior, alertas activas y cambios recientes en ordenes medicas.

ZendiAssist analiza los datos del turno anterior y prioriza la informacion segun urgencia. Por ejemplo, si un residente tuvo un episodio de agitacion durante el turno nocturno, ZendiAssist lo destacara al inicio del Prologo con contexto sobre las intervenciones realizadas. El Prologo se presenta en formato de lista priorizada, con los elementos mas criticos primero. El cuidador puede marcar cada item como leido para confirmar que lo reviso. Es importante recordar que el Prologo es una herramienta de apoyo generada por inteligencia artificial y no sustituye la comunicacion directa entre cuidadores ni el criterio clinico del profesional de enfermeria.

PREGUNTAS:
P: Cuando se genera el Prologo del Turno?
a) Al inicio de cada dia automaticamente
b) Cuando el supervisor lo solicita
*c) Cuando el cuidador entrante confirma la recepcion del handover
d) 30 minutos antes de cada cambio de turno
EXPLICACION: El Prologo se genera automaticamente en el momento en que el cuidador entrante confirma que recibio el handover, asegurando que la informacion este actualizada.

P: Que informacion incluye el Prologo del Turno?
a) Solo los medicamentos pendientes de administrar
b) Unicamente las tareas incompletas del turno anterior
*c) Estado de residentes, medicamentos proximos, pendientes transferidos, alertas y cambios en ordenes
d) Solo los incidentes graves ocurridos en las ultimas 24 horas
EXPLICACION: El Prologo es un resumen completo que incluye estado de residentes, medicamentos, pendientes transferidos, alertas activas y cambios en ordenes medicas.

P: Como prioriza ZendiAssist la informacion en el Prologo?
a) Alfabeticamente por nombre del residente
b) Cronologicamente por hora del evento
*c) Segun la urgencia, con los elementos mas criticos primero
d) Aleatoriamente para evitar sesgos
EXPLICACION: ZendiAssist analiza la urgencia de cada elemento y presenta los mas criticos al inicio del Prologo, facilitando que el cuidador atienda primero lo mas importante.

P: El Prologo del Turno sustituye la comunicacion directa entre cuidadores?
a) Si, es un reemplazo completo del handover presencial
b) Si, siempre que el cuidador confirme que lo leyo
*c) No, es una herramienta de apoyo que complementa pero no sustituye la comunicacion directa
d) Solo en turnos nocturnos donde no hay coincidencia presencial
EXPLICACION: El Prologo es una herramienta de apoyo generada por IA que complementa pero nunca sustituye la comunicacion directa entre cuidadores ni el criterio clinico profesional.

P: Que puede hacer el cuidador con cada item del Prologo?
a) Eliminarlo si no le parece relevante
b) Editarlo para agregar su propia interpretacion
*c) Marcarlo como leido para confirmar que lo reviso
d) Reenviarlo al supervisor para aprobacion
EXPLICACION: El cuidador puede marcar cada item como leido, lo que genera un registro de que la informacion fue revisada y ayuda a garantizar que no se omita ningun elemento critico.

---SECCION_4---
LECTURA:
# Documentacion del handover

La documentacion adecuada del handover es un requisito regulatorio y una practica esencial para la seguridad del residente. En Zendity, la documentacion del handover se genera parcialmente de forma automatica y parcialmente por el cuidador saliente. La parte automatica incluye el digest del turno: un resumen generado por el sistema con todas las acciones registradas, medicamentos administrados, incidentes documentados y tareas completadas o pendientes.

La parte manual requiere que el cuidador saliente agregue observaciones contextuales que el sistema no puede capturar automaticamente. Esto incluye cambios sutiles en el comportamiento de un residente, conversaciones con familiares, instrucciones verbales del medico que aun no se reflejan en ordenes formales, y cualquier situacion inusual. Zendity proporciona campos estructurados para estas observaciones, organizados por residente. El cuidador puede usar ZendiAssist para dar formato a sus notas, pero el contenido clinico debe ser siempre validado por el profesional. La documentacion completa del handover queda vinculada al registro de cierre del turno saliente y al registro de apertura del turno entrante.

PREGUNTAS:
P: Que componentes tiene la documentacion del handover en Zendity?
a) Solo la parte automatica generada por el sistema
b) Solo las notas manuales del cuidador
*c) Una parte automatica (digest del turno) y una parte manual (observaciones del cuidador)
d) Un formulario impreso que se escanea al sistema
EXPLICACION: La documentacion combina el digest automatico del sistema con las observaciones manuales del cuidador, creando un registro completo que incluye tanto datos objetivos como contexto clinico.

P: Que tipo de informacion debe agregar manualmente el cuidador saliente?
a) Solo los medicamentos que administro durante el turno
*b) Observaciones contextuales como cambios sutiles en comportamiento, conversaciones con familiares e instrucciones verbales del medico
c) Una lista de todas las tareas que completo
d) Solo los incidentes formales que ya estan en el sistema
EXPLICACION: El cuidador debe agregar informacion contextual que el sistema no captura automaticamente, como cambios de comportamiento, conversaciones con familiares e instrucciones verbales pendientes de formalizar.

P: Que incluye el digest automatico del turno?
*a) Acciones registradas, medicamentos administrados, incidentes y tareas completadas o pendientes
b) Solo los medicamentos administrados y los pendientes
c) Unicamente los incidentes graves reportados
d) Las calificaciones de desempeno del cuidador
EXPLICACION: El digest automatico es un resumen completo que incluye todas las acciones, medicamentos, incidentes y el estado de las tareas durante el turno.

P: Puede el cuidador usar ZendiAssist para la documentacion del handover?
a) No, toda la documentacion debe ser manual
b) Si, y ZendiAssist puede redactar el contenido clinico autonomamente
*c) Si, para dar formato a las notas, pero el contenido clinico debe ser validado por el profesional
d) Solo si el supervisor lo autoriza
EXPLICACION: ZendiAssist puede ayudar con el formato de las notas, pero el contenido clinico siempre debe ser validado por el profesional de salud, ya que la IA no sustituye el criterio clinico.

P: A que registros queda vinculada la documentacion del handover?
a) Solo al registro del turno saliente
b) Solo al registro del turno entrante
*c) Al registro de cierre del turno saliente y al registro de apertura del turno entrante
d) A un registro independiente accesible solo por el supervisor
EXPLICACION: La documentacion del handover se vincula a ambos turnos, creando un puente auditable entre el cierre del turno saliente y la apertura del turno entrante.

---SECCION_5---
LECTURA:
# Manejo de pendientes y escalado

Una de las situaciones mas desafiantes durante el handover es cuando el turno saliente deja pendientes criticos sin resolver. Zendity clasifica estos pendientes y ofrece rutas claras de accion para el cuidador entrante. Si el cuidador saliente no documento adecuadamente un incidente o dejo un medicamento MISSED sin justificacion, el sistema marca estos elementos como pendientes criticos del handover.

El cuidador entrante tiene tres opciones para cada pendiente critico: resolver directamente si tiene la informacion necesaria, escalar al supervisor para que tome una decision, o documentar la situacion y continuar con precaucion adicional. El escalado al supervisor es obligatorio cuando el pendiente involucra medicamentos controlados, caidas no documentadas o cualquier situacion que pueda representar un riesgo inmediato. Zendity facilita el escalado con un boton dedicado que notifica al supervisor con toda la informacion contextual. Si el supervisor no responde en el tiempo establecido, el sistema escala automaticamente al administrador de la facilidad. Nunca se debe usar Override Forzado para resolver pendientes del handover sin autorizacion explicita del supervisor.

PREGUNTAS:
P: Que opciones tiene el cuidador entrante ante un pendiente critico del handover?
a) Solo puede esperar a que el cuidador saliente regrese a resolverlo
b) Debe resolverlo inmediatamente sin importar la complejidad
*c) Resolver directamente, escalar al supervisor, o documentar y continuar con precaucion
d) Transferirlo automaticamente al siguiente turno
EXPLICACION: El cuidador entrante puede resolver el pendiente si tiene la informacion, escalarlo al supervisor, o documentarlo y continuar con precaucion adicional, dependiendo de la situacion.

P: Cuando es obligatorio escalar un pendiente al supervisor?
a) Siempre que haya cualquier pendiente del turno anterior
b) Solo cuando el cuidador entrante no entiende la situacion
*c) Cuando involucra medicamentos controlados, caidas no documentadas o riesgo inmediato
d) Solo durante turnos nocturnos
EXPLICACION: El escalado al supervisor es obligatorio especificamente cuando los pendientes involucran medicamentos controlados, caidas sin documentar o cualquier situacion de riesgo inmediato para el residente.

P: Que sucede si el supervisor no responde al escalado en el tiempo establecido?
a) El cuidador puede usar Override Forzado por su cuenta
b) El pendiente se cancela automaticamente
*c) El sistema escala automaticamente al administrador de la facilidad
d) El cuidador debe esperar indefinidamente
EXPLICACION: Zendity tiene un mecanismo de escalado progresivo: si el supervisor no responde en tiempo, el sistema escala automaticamente al administrador para asegurar que los pendientes criticos se atiendan.

P: Se puede usar Override Forzado para resolver pendientes del handover?
a) Si, es la forma mas rapida de resolverlos
b) Si, pero solo en turnos nocturnos
*c) No, nunca sin autorizacion explicita del supervisor
d) Si, si el cuidador tiene mas de un ano de experiencia
EXPLICACION: El Override Forzado nunca debe usarse para resolver pendientes del handover sin autorizacion explicita del supervisor, ya que estos pendientes requieren revision cuidadosa y decision supervisada.

P: Como facilita Zendity el proceso de escalado al supervisor?
a) Mediante un correo electronico automatico
b) A traves de una llamada telefonica generada por el sistema
*c) Con un boton dedicado que notifica al supervisor con toda la informacion contextual
d) Enviando un mensaje al chat grupal de la facilidad
EXPLICACION: Zendity tiene un boton dedicado de escalado que envia al supervisor toda la informacion contextual del pendiente, facilitando una toma de decision rapida e informada.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 6: USO DE ZENDI AI EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ZENDI_AI_101',
    title: 'Uso de Zendi AI en Zendity',
    description: 'Aprende a usar Zendi AI como herramienta de apoyo: formatos de notas, comunicaciones y sus limites eticos.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🤖',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: Uso de Zendi AI en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende las capacidades y limites de Zendi AI, cuando usarla como apoyo y cuando el criterio clinico humano es indispensable.
TERMINOS_CLAVE: ZendiAssist, FORMAT_NOTES, SUPERVISOR_MEMO, CORPORATE_COMMS_POLISH, FAMILY_MESSAGE, KITCHEN_OBS, Prologo del Turno, Zendi Digest, voz neural, criterio clinico
PREGUNTA_REFLEXION: Un cuidador quiere usar directamente en el expediente lo que Zendi escribio sobre un diagnostico. Que le explicas sobre los limites de Zendi AI?

---SECCION_1---
LECTURA:
# Que es Zendi AI y como funciona

Zendi AI es el motor de inteligencia artificial integrado en la plataforma Zendity. Su componente principal orientado al usuario es ZendiAssist, un asistente que ayuda a los cuidadores y al personal de enfermeria con tareas de documentacion, comunicacion y organizacion de informacion. Zendi AI no es un sistema de diagnostico ni un reemplazo del profesional de salud. Es una herramienta de productividad disenada para reducir la carga administrativa y mejorar la calidad de la documentacion.

ZendiAssist funciona analizando el contexto del turno actual, el historial del residente y las tareas pendientes para ofrecer sugerencias relevantes. Puede redactar borradores de notas, formatear observaciones clinicas, generar resumenes y facilitar la comunicacion entre diferentes audiencias. Todo lo que ZendiAssist produce es un borrador que requiere revision y aprobacion del profesional antes de incorporarse al registro oficial. Esta distincion es fundamental: Zendi AI asiste, no decide. El cuidador mantiene siempre la responsabilidad final sobre el contenido clinico que se documenta en el expediente del residente.

PREGUNTAS:
P: Cual es la funcion principal de ZendiAssist?
a) Diagnosticar condiciones de salud de los residentes
b) Reemplazar al personal de enfermeria en tareas clinicas
*c) Asistir con documentacion, comunicacion y organizacion de informacion
d) Administrar medicamentos automaticamente segun el horario
EXPLICACION: ZendiAssist es una herramienta de productividad que asiste con documentacion, comunicacion y organizacion, no un sistema de diagnostico ni un reemplazo del profesional de salud.

P: Que analiza ZendiAssist para ofrecer sugerencias?
a) Solo los medicamentos programados para el turno
b) Unicamente el historial medico completo del residente
*c) El contexto del turno actual, historial del residente y tareas pendientes
d) Las evaluaciones de desempeno del cuidador
EXPLICACION: ZendiAssist analiza multiples fuentes de datos incluyendo el contexto del turno, el historial del residente y las tareas pendientes para ofrecer sugerencias contextualizadas.

P: Todo lo que produce ZendiAssist es:
a) Un registro oficial que se incorpora automaticamente al expediente
b) Una orden medica que debe ejecutarse inmediatamente
*c) Un borrador que requiere revision y aprobacion del profesional
d) Un documento final que no necesita modificacion
EXPLICACION: ZendiAssist siempre genera borradores. Ningun contenido de la IA se incorpora al registro oficial sin la revision y aprobacion explicita del profesional de salud.

P: Quien mantiene la responsabilidad final sobre el contenido clinico documentado?
a) Zendi AI, porque genero el contenido
b) El supervisor de turno
*c) El cuidador o profesional de enfermeria
d) El administrador de la facilidad
EXPLICACION: El cuidador mantiene siempre la responsabilidad final sobre el contenido clinico. Zendi AI asiste pero no decide, y la responsabilidad profesional no se delega a la inteligencia artificial.

P: Cual es la distincion fundamental sobre Zendi AI que todo empleado debe entender?
a) Que es mas rapida que el personal humano
b) Que funciona sin conexion a internet
*c) Que asiste pero no decide; el criterio clinico es del profesional
d) Que puede acceder a bases de datos medicas externas
EXPLICACION: La distincion fundamental es que Zendi AI asiste pero no decide. El criterio clinico y la responsabilidad profesional permanecen siempre con el ser humano.

---SECCION_2---
LECTURA:
# FORMAT_NOTES y los modos de escritura

ZendiAssist ofrece varios modos de escritura predefinidos que se activan segun el tipo de documento que el cuidador necesita generar. El modo FORMAT_NOTES es el mas utilizado y transforma observaciones informales del cuidador en notas clinicas estructuradas siguiendo el formato requerido por la facilidad. El cuidador puede dictar o escribir libremente y ZendiAssist organiza la informacion en secciones estandarizadas.

Otros modos importantes incluyen SUPERVISOR_MEMO, que genera memorandos internos con tono profesional para comunicacion entre supervisores y administracion. CORPORATE_COMMS_POLISH refina comunicaciones destinadas a nivel corporativo, asegurando formato y tono apropiado. FAMILY_MESSAGE adapta la informacion clinica a un lenguaje accesible para familiares, eliminando jerga medica innecesaria mientras mantiene la precision. KITCHEN_OBS estructura observaciones sobre nutricion y alimentacion en formato estandarizado para el equipo de cocina. Cada modo aplica reglas de formato, vocabulario y nivel de detalle especificas para su audiencia objetivo. Es crucial recordar que ningun modo cambia los hechos: solo cambia como se presentan para diferentes audiencias.

PREGUNTAS:
P: Que hace el modo FORMAT_NOTES de ZendiAssist?
a) Crea diagnosticos automaticos basados en las observaciones
*b) Transforma observaciones informales del cuidador en notas clinicas estructuradas
c) Envia las notas directamente al expediente sin revision
d) Traduce las notas del espanol al ingles
EXPLICACION: FORMAT_NOTES toma las observaciones informales del cuidador y las organiza en notas clinicas con el formato estructurado que requiere la facilidad, sin alterar los hechos.

P: Para que audiencia esta disenado el modo FAMILY_MESSAGE?
a) Para el equipo medico del hospital
b) Para el departamento de recursos humanos
*c) Para familiares de los residentes, usando lenguaje accesible sin jerga medica
d) Para las autoridades regulatorias de Puerto Rico
EXPLICACION: FAMILY_MESSAGE adapta la informacion clinica a un lenguaje que los familiares puedan entender facilmente, eliminando terminologia medica innecesaria pero manteniendo la precision de la informacion.

P: Que modo se usa para comunicaciones con nivel corporativo?
a) SUPERVISOR_MEMO
b) FORMAT_NOTES
*c) CORPORATE_COMMS_POLISH
d) FAMILY_MESSAGE
EXPLICACION: CORPORATE_COMMS_POLISH esta disenado especificamente para refinar comunicaciones destinadas al nivel corporativo, asegurando formato y tono profesional apropiado.

P: Que principio fundamental comparten todos los modos de escritura?
a) Todos generan documentos que no necesitan revision
b) Todos traducen automaticamente entre idiomas
*c) Ningun modo cambia los hechos, solo cambia la presentacion para diferentes audiencias
d) Todos requieren aprobacion del supervisor antes de usarse
EXPLICACION: Todos los modos de escritura mantienen los hechos intactos y solo modifican como se presentan, adaptando formato, vocabulario y nivel de detalle segun la audiencia objetivo.

P: Para que sirve el modo KITCHEN_OBS?
a) Para pedir suministros de cocina al proveedor
b) Para reportar problemas de higiene al supervisor
*c) Para estructurar observaciones de nutricion y alimentacion para el equipo de cocina
d) Para generar menus semanales automaticamente
EXPLICACION: KITCHEN_OBS estructura las observaciones del cuidador sobre nutricion y alimentacion de los residentes en un formato estandarizado que el equipo de cocina puede utilizar directamente.

---SECCION_3---
LECTURA:
# Prologo del Turno y Zendi Digest

Dos de las funciones mas valiosas de Zendi AI son el Prologo del Turno y el Zendi Digest. El Prologo del Turno es un resumen personalizado que ZendiAssist genera para cada cuidador al inicio de su turno. Analiza los eventos del turno anterior, los pendientes transferidos, las alertas activas y el historial reciente de los residentes asignados para crear una panoramica priorizada. El Prologo destaca situaciones que requieren atencion inmediata y contextualiza cada elemento con informacion relevante.

El Zendi Digest es un resumen mas amplio que consolida informacion de multiples turnos, generalmente cubriendo las ultimas veinticuatro horas. Es especialmente util despues de ausencias, turnos nocturnos o fines de semana. El Digest organiza la informacion por residente e incluye tendencias detectadas por la inteligencia artificial, como cambios graduales en patron de sueno, apetito o nivel de actividad. Ambas herramientas son informativas y de apoyo. El cuidador debe verificar la informacion critica directamente en los registros originales y nunca basar decisiones clinicas unicamente en los resumenes generados por Zendi AI, ya que pueden omitir matices importantes.

PREGUNTAS:
P: Cual es la diferencia principal entre el Prologo del Turno y el Zendi Digest?
a) El Prologo es automatico y el Digest es manual
*b) El Prologo cubre el turno anterior; el Digest consolida informacion de multiples turnos
c) El Prologo es para supervisores y el Digest es para cuidadores
d) No hay diferencia, son dos nombres para la misma funcion
EXPLICACION: El Prologo se enfoca en el turno inmediatamente anterior para preparar al cuidador entrante, mientras que el Digest abarca un periodo mas amplio, generalmente veinticuatro horas, consolidando multiples turnos.

P: Cuando es especialmente util el Zendi Digest?
a) Durante turnos diurnos regulares
*b) Despues de ausencias, turnos nocturnos o fines de semana
c) Solo cuando el supervisor lo solicita
d) Unicamente al inicio de cada mes
EXPLICACION: El Digest es particularmente valioso cuando el cuidador necesita ponerse al dia con multiples turnos, como despues de dias libres, fines de semana o turnos nocturnos.

P: Que tipo de tendencias puede detectar Zendi AI en el Digest?
a) Tendencias financieras de la facilidad
b) Patrones de ausentismo del personal
*c) Cambios graduales en patron de sueno, apetito o nivel de actividad de los residentes
d) Tendencias en el uso de suministros medicos
EXPLICACION: Zendi AI analiza datos a lo largo del tiempo para detectar cambios graduales en los residentes, como alteraciones en sueno, apetito o actividad, que podrian no ser evidentes turno a turno.

P: Se deben basar decisiones clinicas unicamente en los resumenes de Zendi AI?
a) Si, si el resumen tiene menos de 24 horas de antiguedad
b) Si, si fue generado por el modo FORMAT_NOTES
*c) No, el cuidador debe verificar informacion critica en los registros originales
d) Si, siempre que el supervisor haya revisado el resumen
EXPLICACION: Las decisiones clinicas nunca deben basarse unicamente en resumenes de Zendi AI. El cuidador debe verificar la informacion critica en los registros originales ya que los resumenes pueden omitir matices importantes.

P: Que informacion analiza ZendiAssist para generar el Prologo del Turno?
a) Solo los medicamentos programados para el turno
*b) Eventos del turno anterior, pendientes transferidos, alertas activas e historial reciente de residentes
c) Unicamente las notas del supervisor
d) Solo los incidentes reportados en las ultimas 12 horas
EXPLICACION: El Prologo integra multiples fuentes: eventos del turno anterior, pendientes, alertas activas y el historial reciente de los residentes asignados para crear una panoramica completa y priorizada.

---SECCION_4---
LECTURA:
# Voz neural y comunicaciones

Zendi AI incluye una funcion de voz neural que permite al cuidador interactuar con ZendiAssist mediante comandos de voz. Esta funcion es particularmente util durante actividades donde las manos del cuidador estan ocupadas, como durante la asistencia con higiene personal o la alimentacion de un residente. El cuidador puede dictar observaciones, solicitar informacion del residente o pedir que ZendiAssist lea en voz alta el Prologo del Turno.

La voz neural tambien facilita las comunicaciones entre equipos. El cuidador puede dictar un mensaje y seleccionar el modo de escritura apropiado. Por ejemplo, puede decir una observacion clinica informal y pedir que ZendiAssist la formatee como SUPERVISOR_MEMO o como FAMILY_MESSAGE. El sistema convierte el audio a texto, aplica el formato seleccionado y presenta el borrador para revision antes de enviarlo. Es importante que el cuidador revise siempre el texto generado antes de aprobarlo, ya que el reconocimiento de voz puede introducir errores, especialmente con nombres propios, terminologia medica especifica o numeros de dosis. La precision en la documentacion clinica es responsabilidad del profesional, no de la herramienta.

PREGUNTAS:
P: En que situaciones es particularmente util la voz neural de Zendi AI?
a) Durante reuniones administrativas
*b) Cuando las manos del cuidador estan ocupadas con actividades de cuidado directo
c) Solo durante turnos nocturnos por el bajo nivel de ruido
d) Exclusivamente para comunicaciones con familiares
EXPLICACION: La voz neural es especialmente util durante tareas de cuidado directo como asistencia con higiene o alimentacion, cuando el cuidador no puede usar las manos para escribir.

P: Que puede hacer un cuidador con la voz neural y los modos de escritura combinados?
a) Generar diagnosticos clinicos por voz
*b) Dictar una observacion informal y pedir que se formatee como SUPERVISOR_MEMO o FAMILY_MESSAGE
c) Enviar mensajes directamente sin revision
d) Modificar ordenes medicas verbalmente
EXPLICACION: La combinacion de voz neural con modos de escritura permite dictar informacion informal y seleccionar el formato apropiado para la audiencia, optimizando el flujo de trabajo del cuidador.

P: Por que es importante revisar el texto generado por voz antes de aprobarlo?
a) Porque el sistema agrega informacion que el cuidador no dijo
b) Porque la voz neural solo funciona en ingles
*c) Porque el reconocimiento de voz puede introducir errores en nombres, terminologia medica o dosis
d) Porque el supervisor debe ver el texto primero
EXPLICACION: El reconocimiento de voz puede cometer errores con nombres propios, terminologia medica especifica y numeros de dosis, areas donde la precision es critica en documentacion clinica.

P: De quien es la responsabilidad de la precision en la documentacion clinica?
a) De Zendi AI, que genero el texto
b) Del departamento de IT que mantiene el sistema
*c) Del profesional de salud que aprueba el contenido
d) Del supervisor que revisa los reportes
EXPLICACION: La precision en la documentacion clinica es siempre responsabilidad del profesional de salud, no de la herramienta. Zendi AI asiste pero el humano valida y aprueba.

P: Que proceso sigue la voz neural para generar un mensaje formateado?
a) Envia el audio directamente al destinatario
b) Convierte el audio a texto y lo envia automaticamente
*c) Convierte audio a texto, aplica el formato seleccionado y presenta un borrador para revision
d) Graba el audio y lo adjunta como nota de voz
EXPLICACION: El proceso tiene tres pasos: conversion de audio a texto, aplicacion del modo de escritura seleccionado, y presentacion del borrador para que el cuidador lo revise y apruebe antes de enviarlo.

---SECCION_5---
LECTURA:
# Limites eticos y criterio clinico

Comprender los limites de Zendi AI es tan importante como saber usarla. Zendi AI no es un sistema de diagnostico medico. No puede determinar condiciones de salud, prescribir tratamientos ni evaluar la gravedad de un sintoma. Cualquier contenido que ZendiAssist genere sobre el estado clinico de un residente es un borrador basado en patrones de texto, no una evaluacion clinica. Usar directamente en el expediente lo que Zendi escribio sobre un diagnostico sin validacion profesional es una violacion de protocolo.

El criterio clinico humano es indispensable en multiples escenarios: evaluacion de cambios en el estado del residente, interpretacion de signos vitales fuera de rango, decisiones sobre cuando escalar al medico y documentacion de observaciones clinicas matizadas. Zendi AI puede ayudar a organizar y presentar informacion, pero la interpretacion y las decisiones son exclusivas del profesional. Ademas, Zendi AI puede generar texto que suena convincente pero que contiene imprecisiones sutiles. Por eso, cada salida de la IA debe tratarse como un borrador inicial que requiere verificacion critica. La regla de oro es simple: Zendi sugiere, el profesional decide.

PREGUNTAS:
P: Que puede determinar Zendi AI sobre la salud de un residente?
a) Diagnosticos preliminares basados en sintomas reportados
b) La gravedad de un sintoma nuevo
*c) Nada diagnostico; solo puede organizar y presentar informacion como borrador
d) Tratamientos sugeridos basados en el historial
EXPLICACION: Zendi AI no tiene capacidad diagnostica. No puede determinar condiciones, prescribir tratamientos ni evaluar gravedad. Solo organiza y presenta informacion como borrador para revision profesional.

P: Que constituye una violacion de protocolo respecto a Zendi AI?
a) Usar la voz neural durante el turno nocturno
b) Pedir a ZendiAssist que resuma las notas del dia
*c) Usar directamente en el expediente lo que Zendi escribio sobre un diagnostico sin validacion profesional
d) Utilizar el modo FAMILY_MESSAGE para comunicarse con familiares
EXPLICACION: Incorporar contenido generado por Zendi AI sobre diagnosticos directamente al expediente sin que un profesional lo valide es una violacion de protocolo porque la IA no tiene capacidad diagnostica.

P: Cual es la regla de oro sobre Zendi AI?
a) Zendi decide, el profesional ejecuta
b) Zendi documenta, el sistema valida
*c) Zendi sugiere, el profesional decide
d) Zendi analiza, el supervisor aprueba
EXPLICACION: La regla de oro es clara: Zendi sugiere y el profesional decide. La responsabilidad de las decisiones clinicas y la validacion del contenido siempre recae en el ser humano.

P: Por que el texto generado por Zendi AI requiere verificacion critica?
a) Porque el sistema tiene errores frecuentes de software
b) Porque solo funciona correctamente en ingles
*c) Porque puede generar texto convincente que contiene imprecisiones sutiles
d) Porque las regulaciones prohiben usar inteligencia artificial en salud
EXPLICACION: Zendi AI puede producir texto que suena profesional y convincente pero que contiene errores sutiles. Por eso cada salida debe tratarse como borrador inicial que necesita verificacion critica del profesional.

P: En cual de estos escenarios el criterio clinico humano es indispensable?
a) Al formatear una nota con FORMAT_NOTES
b) Al generar un Zendi Digest
*c) Al evaluar cambios en el estado de un residente y decidir si escalar al medico
d) Al seleccionar el modo de escritura apropiado para un mensaje
EXPLICACION: La evaluacion de cambios clinicos en un residente y la decision de cuando escalar al medico requieren criterio clinico profesional que Zendi AI no puede proporcionar ni sustituir.
`
}
,

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 7: PROTOCOLO DE RESPUESTA A CAIDAS
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'CAIDAS_101',
    title: 'Protocolo de Respuesta a Caidas',
    description: 'Aprende el protocolo paso a paso para responder a una caida: evaluacion, documentacion, escalado y prevencion.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '⚠️',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: Protocolo de Respuesta a Caidas
PROMPT_ZENDI: Evalua si el empleado conoce el protocolo de respuesta a caidas, incluyendo la regla de no mover, la evaluacion de severidad, la documentacion en Zendity y el escalado correcto.
TERMINOS_CLAVE: no mover, evaluacion clinica, Escala Downton, severidad BAJO/MEDIO/ALTO/CRITICO, ticket de incidente, Triage Center, notificacion familiar, handover, protocolo de emergencia
PREGUNTA_REFLEXION: Encuentras a un residente en el piso, consciente pero con dolor en la cadera. El supervisor no esta disponible. Describe paso a paso lo que haces en Zendity.

---SECCION_1---
LECTURA:
# La Caida como Evento Critico en Senior Living

Las caidas son el evento adverso mas comun en facilidades de cuido de adultos mayores. Segun estadisticas del sector, uno de cada tres residentes mayores de 65 anos sufre al menos una caida al ano. Las consecuencias pueden ser devastadoras: fracturas de cadera, trauma craneal, hospitalizacion prolongada e incluso la muerte.

**Por que las caidas son diferentes a otros incidentes?**

A diferencia de otros eventos, una caida requiere accion inmediata y un protocolo estricto porque:

- **El movimiento puede agravar la lesion**: Mover a un residente con fractura de cadera o lesion cervical puede causar dano irreversible
- **El tiempo de respuesta importa**: Una evaluacion rapida y precisa determina si se activa el protocolo de emergencia
- **La documentacion es evidencia legal**: Todo lo que registres (o dejes de registrar) puede ser revisado por reguladores, aseguradoras y tribunales
- **La prevencion depende de datos**: Cada caida documentada correctamente alimenta el analisis de patrones para prevenir futuras caidas

En Zendity, el protocolo de caidas tiene cuatro fases: respuesta inmediata, evaluacion clinica, documentacion y seguimiento.

PREGUNTAS:
P: Cual es el evento adverso mas comun en facilidades de cuido de adultos mayores?
a) Errores de medicacion
b) Infecciones nosocomiales
*c) Las caidas
d) Deshidratacion severa
EXPLICACION: Las caidas son el evento adverso mas frecuente en senior living, afectando a uno de cada tres residentes mayores de 65 anos cada ano.

P: Por que mover a un residente despues de una caida puede ser peligroso?
a) Porque el residente puede asustarse
b) Porque se activa una alarma automatica
*c) Porque puede agravar una fractura o lesion cervical, causando dano irreversible
d) Porque el seguro no cubre lesiones si el residente fue movido
EXPLICACION: Mover a un residente con una posible fractura de cadera o lesion cervical puede empeorar significativamente la lesion. Por eso existe la regla de no mover.

P: Cuantas fases tiene el protocolo de caidas en Zendity?
a) Dos: respuesta y documentacion
b) Tres: evaluacion, documentacion y prevencion
*c) Cuatro: respuesta inmediata, evaluacion clinica, documentacion y seguimiento
d) Cinco: deteccion, alerta, respuesta, tratamiento y alta
EXPLICACION: El protocolo en Zendity comprende cuatro fases secuenciales: respuesta inmediata, evaluacion clinica, documentacion del incidente y seguimiento post-caida.

P: Por que la documentacion de una caida tiene valor legal?
a) Porque Zendity genera facturas automaticas
*b) Porque lo registrado puede ser revisado por reguladores, aseguradoras y tribunales
c) Porque los familiares firman un contrato digital
d) Porque el sistema envia copias automaticas al tribunal
EXPLICACION: La documentacion de incidentes es evidencia legal. Reguladores, aseguradoras y tribunales pueden solicitar los registros para investigar lo ocurrido.

P: Como contribuye la documentacion correcta de caidas a la prevencion?
a) Eliminando automaticamente los riesgos del ambiente
b) Notificando a todos los familiares simultaneamente
*c) Alimentando el analisis de patrones para prevenir futuras caidas
d) Generando ordenes medicas automaticas
EXPLICACION: Cada caida documentada correctamente proporciona datos que permiten identificar patrones (horarios, ubicaciones, condiciones) y tomar medidas preventivas.

---SECCION_2---
LECTURA:
# Respuesta Inmediata — La Regla de No Mover

Cuando encuentras a un residente en el piso, los primeros 60 segundos son criticos. La regla numero uno es: **NO MOVER al residente**. Esta regla aplica en todos los casos hasta que un profesional clinico autorice el movimiento.

**Pasos inmediatos al encontrar un residente caido:**

1. **Mantener la calma** y acercarte al residente hablando con voz tranquila
2. **NO intentar levantarlo** ni cambiar su posicion bajo ninguna circunstancia
3. **Evaluar si esta consciente**: Preguntale su nombre y si sabe donde esta
4. **Verificar respiracion visible** sin mover su cabeza o cuello
5. **Solicitar ayuda**: Usa el sistema de alertas de Zendity o llama a la enfermera de turno

**Excepciones a la regla de no mover:**

Solo se puede mover al residente antes de la evaluacion clinica si existe un peligro ambiental inmediato — por ejemplo, si hay un incendio activo o riesgo de electrocucion. En cualquier otro caso, espera a la enfermera.

**Mientras esperas al profesional clinico:**

- Quedate con el residente, no lo dejes solo
- Habla con el para mantenerlo calmado y consciente
- Observa y memoriza detalles: posicion exacta, si hay sangre, si hay objetos cercanos que pudieron causar la caida
- Si esta inconsciente pero respira, no intentes reanimacion — espera al equipo clinico

PREGUNTAS:
P: Cual es la regla numero uno cuando encuentras a un residente en el piso?
a) Levantarlo inmediatamente para evitar que se enfrie
b) Llamar primero a la familia
*c) NO mover al residente hasta que un profesional clinico lo autorice
d) Colocar una almohada debajo de su cabeza
EXPLICACION: La regla de no mover es absoluta. Cualquier movimiento sin evaluacion clinica puede agravar fracturas o lesiones cervicales que no son visibles a simple vista.

P: Cual es la unica excepcion a la regla de no mover?
a) Si el residente pide que lo levanten
b) Si el supervisor da la orden por telefono
*c) Si existe un peligro ambiental inmediato como incendio o riesgo de electrocucion
d) Si ya pasaron mas de 10 minutos
EXPLICACION: Solo se puede mover al residente sin evaluacion clinica si hay un peligro ambiental inmediato que ponga en riesgo su vida, como un incendio activo.

P: Que debes hacer mientras esperas a la enfermera de turno?
a) Intentar sentar al residente contra la pared
b) Ir a buscar un botiquin de primeros auxilios
*c) Quedarte con el residente, hablarle con calma y observar detalles del entorno
d) Llamar al 911 inmediatamente
EXPLICACION: Debes permanecer con el residente, mantenerlo calmado y observar detalles clave (posicion, sangre, objetos cercanos) que seran importantes para la evaluacion y documentacion.

P: Si el residente esta inconsciente pero respira, que debes hacer?
a) Iniciar RCP inmediatamente
b) Sacudirlo para despertarlo
c) Moverlo a posicion de recuperacion
*d) No intentar reanimacion y esperar al equipo clinico
EXPLICACION: Si el residente esta inconsciente pero respira, no se debe intentar reanimacion ni moverlo. Se espera al equipo clinico que tiene el entrenamiento para evaluar la situacion.

P: Que detalles debes observar mientras esperas junto al residente?
a) Solo la hora exacta de la caida
b) El nombre del residente unicamente
*c) Posicion exacta, presencia de sangre y objetos cercanos que pudieron causar la caida
d) Los medicamentos que toma el residente
EXPLICACION: Observar la posicion del residente, si hay sangre, y objetos del entorno es crucial para que el equipo clinico entienda el mecanismo de la caida y para documentar el incidente correctamente.

---SECCION_3---
LECTURA:
# Evaluacion Clinica y Escala Downton

Una vez que llega la enfermera o profesional clinico, comienza la fase de evaluacion. Zendity utiliza la **Escala Downton** como herramienta estandarizada para medir el riesgo de caidas y clasificar la severidad del evento.

**La Escala Downton evalua:**

- **Caidas previas**: Si el residente ha tenido caidas anteriores documentadas
- **Medicamentos**: Uso de sedantes, diureticos, antihipertensivos u otros farmacos que aumentan el riesgo
- **Deficit sensorial**: Problemas de vision, audicion o extremidades
- **Estado mental**: Orientacion, confusion o agitacion
- **Marcha**: Capacidad de caminar de forma segura e independiente

**Niveles de severidad en Zendity:**

Despues de la evaluacion, la enfermera clasifica el evento en uno de cuatro niveles:

- **BAJO**: El residente se cayo pero no presenta dolor, lesion visible ni cambio en su estado. Ejemplo: resbalon menor, el residente se levanto solo antes de que llegaran
- **MEDIO**: Hay dolor localizado, hematomas o abrasiones menores. El residente necesita observacion adicional
- **ALTO**: Hay sospecha de fractura, herida abierta o golpe en la cabeza. Se requiere atencion medica inmediata
- **CRITICO**: El residente esta inconsciente, no respira adecuadamente o tiene deformidad visible. Se activa protocolo de emergencia y 911

PREGUNTAS:
P: Que herramienta estandarizada usa Zendity para evaluar el riesgo de caidas?
a) Escala de Glasgow
b) Escala de Braden
*c) Escala Downton
d) Indice de Barthel
EXPLICACION: Zendity utiliza la Escala Downton, que evalua factores como caidas previas, medicamentos, deficit sensorial, estado mental y marcha para medir el riesgo de caidas.

P: Que nivel de severidad se asigna si el residente tiene dolor localizado y hematomas menores?
a) BAJO
*b) MEDIO
c) ALTO
d) CRITICO
EXPLICACION: El nivel MEDIO aplica cuando hay dolor localizado, hematomas o abrasiones menores que requieren observacion adicional pero no atencion medica de emergencia.

P: En que nivel de severidad se activa el protocolo de emergencia y se llama al 911?
a) BAJO
b) MEDIO
c) ALTO
*d) CRITICO
EXPLICACION: El nivel CRITICO se activa cuando el residente esta inconsciente, no respira adecuadamente o tiene deformidad visible. Requiere activar el protocolo de emergencia y llamar al 911.

P: Cual de estos factores NO es parte de la Escala Downton?
a) Caidas previas documentadas
b) Uso de medicamentos sedantes
*c) Historial de alergias alimentarias
d) Deficit sensorial y estado mental
EXPLICACION: La Escala Downton evalua caidas previas, medicamentos, deficit sensorial, estado mental y marcha. Las alergias alimentarias no son un factor de la escala.

P: Que diferencia un evento de severidad ALTO de uno MEDIO?
a) La hora del dia en que ocurrio la caida
*b) La sospecha de fractura, herida abierta o golpe en la cabeza
c) La edad del residente
d) Si el residente tenia zapatos puestos o no
EXPLICACION: Un evento ALTO implica sospecha de fractura, herida abierta o golpe en la cabeza, lo cual requiere atencion medica inmediata a diferencia del nivel MEDIO que solo necesita observacion.

---SECCION_4---
LECTURA:
# Documentacion del Incidente en Zendity

La documentacion es la columna vertebral del protocolo de caidas. En Zendity, cada caida genera un **ticket de incidente** que debe completarse con precision. Un ticket mal documentado es peor que no tener documentacion: crea lagunas legales y dificulta la prevencion.

**Como crear un ticket de incidente de caida:**

1. **Accede al modulo de Incidentes** desde el Care Floor o desde la alerta de caida
2. **Selecciona el tipo**: Caida confirmada o Cuasi-caida (near miss)
3. **Registra la hora exacta** del descubrimiento (no la hora estimada de la caida)
4. **Describe las circunstancias**: Donde estaba el residente, que estaba haciendo, condiciones del piso, iluminacion, calzado
5. **Adjunta la evaluacion clinica**: Resultado de la Escala Downton y nivel de severidad asignado

**Escalado automatico segun severidad:**

Zendity escala automaticamente segun el nivel de severidad:

- **BAJO/MEDIO**: Notificacion al supervisor de turno. El supervisor revisa y decide si escala
- **ALTO**: Notificacion inmediata al Triage Center, supervisor y director. Se genera alerta para evaluacion medica
- **CRITICO**: Notificacion a toda la cadena de mando. Se activa protocolo de emergencia. Notificacion familiar automatica

**Notificacion familiar:**

Para eventos ALTO y CRITICO, Zendity envia una notificacion al portal familiar automaticamente. Para eventos BAJO y MEDIO, el supervisor decide si notifica a la familia. Toda comunicacion familiar queda registrada en el ticket.

PREGUNTAS:
P: Que hora debe registrarse en el ticket de incidente de caida?
a) La hora estimada en que ocurrio la caida
*b) La hora exacta en que se descubrio al residente en el piso
c) La hora del cambio de turno mas cercano
d) La hora en que la enfermera completo la evaluacion
EXPLICACION: Se registra la hora exacta del descubrimiento, no una estimacion. Esto asegura precision legal y evita discrepancias en la documentacion.

P: Que sucede automaticamente en Zendity cuando se clasifica una caida como CRITICO?
a) Solo se notifica al supervisor de turno
b) Se genera un reporte para revision al dia siguiente
*c) Se notifica a toda la cadena de mando, se activa protocolo de emergencia y se notifica a la familia automaticamente
d) Se cierra automaticamente el ticket sin intervencion
EXPLICACION: En nivel CRITICO, Zendity activa el escalado maximo: toda la cadena de mando es notificada, se activa el protocolo de emergencia y se envia notificacion familiar automatica.

P: Para que niveles de severidad se envia notificacion familiar automatica?
a) Solo CRITICO
b) Todos los niveles
*c) ALTO y CRITICO
d) MEDIO, ALTO y CRITICO
EXPLICACION: La notificacion familiar automatica se activa para eventos clasificados como ALTO y CRITICO. Para BAJO y MEDIO, el supervisor decide si informa a la familia.

P: Que elementos deben incluirse en la descripcion de circunstancias del ticket?
a) Solo el nombre del residente y la hora
b) Unicamente la evaluacion de la enfermera
*c) Ubicacion, actividad del residente, condiciones del piso, iluminacion y calzado
d) Solo una fotografia del area
EXPLICACION: Las circunstancias deben describir el contexto completo: donde estaba el residente, que hacia, condiciones ambientales (piso, luz) y calzado, para analisis de causas.

P: Que diferencia hay entre una "caida confirmada" y una "cuasi-caida" en el ticket?
a) No hay diferencia, ambas se documentan igual
b) La cuasi-caida solo se registra verbalmente
*c) La caida confirmada implica que el residente llego al piso; la cuasi-caida es cuando estuvo a punto de caer pero no llego al suelo
d) La cuasi-caida solo aplica a empleados, no a residentes
EXPLICACION: Una caida confirmada significa que el residente termino en el piso. Una cuasi-caida (near miss) es cuando estuvo a punto de caer pero se detuvo o fue sostenido. Ambas se documentan en Zendity.

---SECCION_5---
LECTURA:
# Prevencion y Seguimiento Post-Caida

La ultima fase del protocolo es la mas importante a largo plazo: convertir el incidente en aprendizaje para prevenir futuras caidas. Zendity facilita este proceso con herramientas de analisis y seguimiento continuo.

**Seguimiento post-caida obligatorio:**

Despues de toda caida clasificada como MEDIO o superior, Zendity genera automaticamente un plan de seguimiento que incluye:

- **Monitoreo neurologico**: Observaciones cada 2 horas durante las primeras 24 horas si hubo golpe en la cabeza
- **Evaluacion de movilidad**: Reevaluar si el residente necesita asistencia adicional para caminar
- **Revision de medicamentos**: Verificar si algun medicamento pudo contribuir a la caida (sedantes, diureticos, antihipertensivos)
- **Ajuste ambiental**: Inspeccionar y corregir condiciones del area donde ocurrio la caida

**Handover obligatorio:**

Toda caida debe incluirse en el handover de turno. El cuidador saliente debe comunicar al entrante: que ocurrio, que nivel de severidad se asigno, que seguimiento esta activo y que observaciones deben continuar.

**Analisis de patrones:**

Zendity compila datos de todas las caidas para identificar patrones: horarios de mayor riesgo, areas problematicas, residentes con caidas recurrentes y correlaciones con medicamentos. Estos reportes estan disponibles en el dashboard del supervisor para tomar decisiones preventivas basadas en evidencia.

PREGUNTAS:
P: A partir de que nivel de severidad genera Zendity un plan de seguimiento automatico?
a) BAJO
*b) MEDIO
c) ALTO
d) CRITICO
EXPLICACION: Zendity genera automaticamente un plan de seguimiento para toda caida clasificada como MEDIO o superior, incluyendo monitoreo neurologico, evaluacion de movilidad y revision de medicamentos.

P: Cada cuanto se realizan observaciones neurologicas si hubo golpe en la cabeza?
a) Cada 30 minutos durante 6 horas
*b) Cada 2 horas durante las primeras 24 horas
c) Una sola vez al final del turno
d) Solo cuando la familia lo solicita
EXPLICACION: El protocolo de seguimiento establece observaciones neurologicas cada 2 horas durante las primeras 24 horas despues de un golpe en la cabeza para detectar complicaciones tempranas.

P: Que informacion debe comunicar el cuidador saliente en el handover sobre una caida?
a) Solo el nombre del residente que se cayo
b) Unicamente el nivel de severidad asignado
*c) Que ocurrio, nivel de severidad, seguimiento activo y observaciones pendientes
d) Solo si la familia fue notificada
EXPLICACION: El handover de caida debe ser completo: que ocurrio, severidad asignada, plan de seguimiento activo y observaciones que el turno entrante debe continuar realizando.

P: Que tipo de analisis compila Zendity con los datos de todas las caidas?
a) Solo estadisticas de costos medicos
b) Unicamente el numero total de caidas al mes
*c) Patrones de horarios, areas problematicas, residentes recurrentes y correlaciones con medicamentos
d) Solo informacion para las aseguradoras
EXPLICACION: Zendity analiza patrones incluyendo horarios de mayor riesgo, areas problematicas, residentes con caidas recurrentes y correlaciones con medicamentos para facilitar la prevencion basada en evidencia.

P: Que accion preventiva se toma respecto al area donde ocurrio la caida?
a) Se cierra el area permanentemente
b) Se instalan camaras automaticamente
*c) Se inspecciona y corrigen las condiciones ambientales del area
d) Se prohibe el acceso a todos los residentes
EXPLICACION: Despues de una caida, se realiza un ajuste ambiental que incluye inspeccionar y corregir condiciones del area como iluminacion, estado del piso, obstaculos y otros factores de riesgo.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 8: EL CUIDADOR EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'CUIDADOR_101',
    title: 'El Cuidador en Zendity',
    description: 'Guia completa del rol del cuidador en Zendity: tu workspace, Prologo del Turno, eMAR basico y cierre de turno.',
    durationMins: 30,
    bonusCompliance: 10,
    emoji: '💚',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: El Cuidador en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende su flujo de trabajo diario como cuidador en Zendity, desde el inicio del turno hasta el cierre, incluyendo eMAR y manejo de MISSED.
TERMINOS_CLAVE: workspace /care, Prologo del Turno, grupo de color, eMAR, Daily Log, MISSED, Override Forzado, cierre de turno, ZendiAssist, handover
PREGUNTA_REFLEXION: Es tu primer turno como cuidador. Zendi lee el Prologo. Tienes 3 residentes asignados, uno con medicamentos MISSED del turno anterior. Cual es tu primer paso?

---SECCION_1---
LECTURA:
# Tu Workspace: La Pantalla /care

Como cuidador en Zendity, tu espacio de trabajo principal es la pantalla **/care** — el Care Floor. Esta interfaz esta disenada para que puedas gestionar tu turno completo sin salir de ella. Todo lo que necesitas esta a un tap de distancia.

**Que ves al entrar a /care:**

- **Tu grupo de color asignado**: Los residentes estan organizados en grupos de color (Rojo, Amarillo, Verde, Azul). Tu grupo aparece destacado en la parte superior. Solo ves los residentes que te corresponden.
- **Tarjetas de residente**: Cada residente tiene una tarjeta con su foto, nombre, habitacion y alertas activas. Las tarjetas con bordes rojos indican tareas urgentes pendientes.
- **Barra de estado del turno**: Muestra el progreso de tu turno — cuantas tareas has completado versus cuantas quedan pendientes.
- **Boton de ZendiAssist**: Acceso directo al asistente de voz que te puede guiar si tienes dudas sobre un procedimiento.

**Navegacion clave:**

Al tocar una tarjeta de residente, accedes a su perfil con tres pestanas principales: Medicamentos (eMAR), Notas (Daily Log) y Alertas. La navegacion esta disenada para uso con una sola mano en tablet, porque frecuentemente la otra mano esta asistiendo al residente.

PREGUNTAS:
P: Cual es el espacio de trabajo principal del cuidador en Zendity?
a) La pantalla /admin
b) El modulo de Reportes
*c) La pantalla /care (Care Floor)
d) El portal de familias
EXPLICACION: El Care Floor (/care) es el espacio disenado especificamente para cuidadores, donde gestionan su turno completo con acceso a residentes, medicamentos y notas.

P: Como se organizan los residentes en el Care Floor?
a) Por orden alfabetico
b) Por nivel de gravedad medica
*c) Por grupos de color (Rojo, Amarillo, Verde, Azul)
d) Por numero de habitacion unicamente
EXPLICACION: Los residentes se organizan en grupos de color para facilitar la asignacion. Cada cuidador ve destacado su grupo asignado y solo los residentes que le corresponden.

P: Que indica una tarjeta de residente con borde rojo?
a) Que el residente esta de cumpleanos
b) Que el residente fue dado de alta
*c) Que tiene tareas urgentes pendientes
d) Que pertenece al grupo de color rojo
EXPLICACION: Los bordes rojos en las tarjetas de residente indican que hay tareas urgentes pendientes que el cuidador debe atender, como medicamentos sin administrar o alertas activas.

P: Para que sirve el boton de ZendiAssist en /care?
a) Para llamar al supervisor directamente
b) Para enviar mensajes a la familia
*c) Para acceder al asistente de voz que guia en procedimientos
d) Para cerrar sesion rapidamente
EXPLICACION: ZendiAssist es el asistente de voz de Zendity que puede guiar al cuidador cuando tiene dudas sobre un procedimiento, protocolo o funcionalidad del sistema.

P: Por que la navegacion del Care Floor esta disenada para uso con una sola mano?
a) Porque los dispositivos son muy pequenos
b) Porque es mas rapido
*c) Porque frecuentemente la otra mano esta asistiendo al residente
d) Porque solo se usa en celulares, no en tablets
EXPLICACION: La interfaz permite uso con una mano en tablet porque los cuidadores frecuentemente estan asistiendo fisicamente al residente con la otra mano mientras documentan.

---SECCION_2---
LECTURA:
# El Prologo del Turno y Grupos de Color

Cada turno en Zendity comienza con el **Prologo del Turno** — un resumen narrado por Zendi (el asistente de voz) que te prepara para las proximas horas. Este prologo se activa automaticamente cuando inicias sesion al comienzo de tu turno.

**Que incluye el Prologo del Turno:**

- **Resumen de handover**: Informacion clave que dejo el turno anterior — caidas, cambios de medicamento, comportamientos inusuales
- **Tus residentes asignados**: Lista de residentes en tu grupo de color con sus alertas activas
- **Medicamentos MISSED**: Si algun medicamento del turno anterior no fue administrado, Zendi lo anuncia para que lo priorices
- **Tareas pendientes del turno**: Medicamentos programados, rondas pendientes, citas medicas del dia
- **Alertas especiales**: Residentes nuevos, cambios recientes en ordenes medicas, restricciones dieteticas

**El sistema de grupos de color:**

Tu grupo de color determina de cuales residentes eres responsable. La asignacion la hace el supervisor antes del turno usando el Schedule Builder. Los colores no tienen jerarquia — son simplemente una forma de distribuir la carga de trabajo equitativamente.

Si un compuesto de tu turno tiene una emergencia con uno de sus residentes, el supervisor puede reasignarte temporalmente residentes de otro color. Esto se refleja automaticamente en tu pantalla /care.

PREGUNTAS:
P: Que es el Prologo del Turno en Zendity?
a) Un formulario que el cuidador debe llenar al iniciar
b) Una reunion presencial con el supervisor
*c) Un resumen narrado por Zendi que prepara al cuidador para su turno
d) Un examen de conocimientos al inicio de cada turno
EXPLICACION: El Prologo del Turno es un resumen automatico narrado por Zendi (el asistente de voz) que incluye handover, residentes asignados, medicamentos MISSED y tareas pendientes.

P: Cuando se activa el Prologo del Turno?
a) Cuando el supervisor lo solicita manualmente
b) 30 minutos antes del inicio del turno
*c) Automaticamente cuando el cuidador inicia sesion al comienzo del turno
d) Solo los lunes de cada semana
EXPLICACION: El Prologo se activa automaticamente al iniciar sesion al comienzo del turno, asegurando que todo cuidador reciba la informacion critica antes de comenzar a trabajar.

P: Si hay medicamentos MISSED del turno anterior, como se entera el cuidador?
a) Leyendo un correo electronico
b) El supervisor le llama por telefono
*c) Zendi lo anuncia como parte del Prologo del Turno
d) No se entera hasta que revisa el eMAR manualmente
EXPLICACION: Los medicamentos MISSED del turno anterior se anuncian en el Prologo del Turno para que el cuidador entrante los priorice inmediatamente.

P: Quien asigna los grupos de color a los cuidadores?
a) El cuidador elige su propio grupo cada dia
b) Se asignan aleatoriamente por el sistema
*c) El supervisor los asigna antes del turno usando el Schedule Builder
d) Se rotan automaticamente cada semana
EXPLICACION: El supervisor asigna los grupos de color antes de cada turno mediante el Schedule Builder, distribuyendo la carga de trabajo equitativamente entre los cuidadores disponibles.

P: Que sucede si un companero tiene una emergencia con uno de sus residentes?
a) Nada, cada cuidador solo atiende su grupo
b) Se cancela el turno completo
*c) El supervisor puede reasignar temporalmente residentes de otro color a tu pantalla
d) El residente queda sin atencion hasta el proximo turno
EXPLICACION: El supervisor puede reasignar temporalmente residentes de otro grupo de color al cuidador disponible. El cambio se refleja automaticamente en la pantalla /care.

---SECCION_3---
LECTURA:
# eMAR Basico para Cuidadores

El eMAR (Electronic Medication Administration Record) es el modulo donde se registra la administracion de medicamentos. Como cuidador, tu rol en el eMAR es ejecutar las administraciones programadas bajo la supervision de la enfermera de turno.

**Tu flujo en el eMAR:**

1. **Revisa la lista de medicamentos** de tu residente. Cada medicamento muestra: nombre, dosis, via de administracion, hora programada y una foto de referencia
2. **Verifica los "5 correctos"**: Residente correcto, medicamento correcto, dosis correcta, via correcta, hora correcta
3. **Administra el medicamento** siguiendo las instrucciones en pantalla
4. **Registra la administracion** tocando el boton de confirmacion. Zendity registra tu PIN, la hora exacta y el medicamento

**Estados de un medicamento en el eMAR:**

- **PENDIENTE** (gris): Aun no es hora de administrarlo
- **LISTO** (azul): Es hora de administrarlo — requiere tu accion
- **ADMINISTRADO** (verde): Se registro la administracion correctamente
- **MISSED** (rojo): La ventana de tiempo para administrarlo paso sin registro. Requiere atencion inmediata
- **RECHAZADO**: El residente se nego a tomar el medicamento — debe documentarse el motivo

**Importante**: Como cuidador, NO puedes modificar ordenes medicas, cambiar dosis ni reprogramar horarios. Esas acciones requieren el rol NURSE o superior.

PREGUNTAS:
P: Cual es el rol del cuidador en el eMAR?
a) Crear ordenes medicas para residentes nuevos
*b) Ejecutar las administraciones de medicamentos programadas bajo supervision de enfermera
c) Modificar dosis segun su criterio clinico
d) Aprobar cambios en los horarios de medicamentos
EXPLICACION: El cuidador ejecuta las administraciones programadas en el eMAR. No puede crear ordenes, modificar dosis ni reprogramar horarios — eso requiere rol NURSE o superior.

P: Cuales son los "5 correctos" que debe verificar el cuidador?
a) Nombre, apellido, habitacion, turno y fecha
*b) Residente correcto, medicamento correcto, dosis correcta, via correcta, hora correcta
c) Color, tamano, forma, olor y sabor del medicamento
d) PIN, sesion, dispositivo, ubicacion y permiso
EXPLICACION: Los 5 correctos son: residente correcto, medicamento correcto, dosis correcta, via correcta y hora correcta. Es un estandar de seguridad en la administracion de medicamentos.

P: Que indica el estado MISSED (rojo) en el eMAR?
a) Que el medicamento fue administrado exitosamente
b) Que el residente fue trasladado a otro centro
*c) Que la ventana de tiempo para administrar el medicamento paso sin registro
d) Que el medicamento esta en backorder
EXPLICACION: MISSED significa que el medicamento no fue registrado dentro de su ventana de tiempo programada. Es un estado critico que requiere atencion inmediata y seguimiento.

P: Que debe hacer el cuidador si un residente se niega a tomar su medicamento?
a) Forzar al residente a tomarlo
b) Ignorar el medicamento y pasar al siguiente
*c) Documentar el rechazo y registrar el motivo en el eMAR
d) Administrar el medicamento en la comida sin que el residente se de cuenta
EXPLICACION: Si un residente rechaza su medicamento, el cuidador debe documentar el rechazo en el eMAR con el motivo. Nunca se debe forzar ni administrar medicamentos sin conocimiento del residente.

P: Que informacion registra Zendity automaticamente al confirmar una administracion?
a) Solo el nombre del medicamento
b) Unicamente la hora del registro
*c) El PIN del cuidador, la hora exacta y el medicamento administrado
d) Solo el estado de animo del residente
EXPLICACION: Al confirmar una administracion, Zendity registra automaticamente el PIN del cuidador (quien lo hizo), la hora exacta (cuando) y el medicamento (que), creando un registro auditable.

---SECCION_4---
LECTURA:
# Daily Log y Documentacion

El **Daily Log** es tu herramienta de documentacion continua durante el turno. Cada nota que escribes se convierte en parte del expediente oficial del residente, visible para enfermeras, supervisores y — en caso de auditorias — para reguladores.

**Cuando documentar en el Daily Log:**

- **Observaciones de comportamiento**: Cambios de animo, agitacion, confusion, somnolencia inusual
- **Ingesta de alimentos**: Si el residente comio bien, poco, o rechazo alimentos
- **Actividades completadas**: Bano, cambio de ropa, ejercicios, actividades recreativas
- **Signos vitales basicos**: Temperatura, presion, si el protocolo de tu Sede lo requiere
- **Eventos inusuales**: Cualquier cosa fuera de lo normal — queja de dolor, visita inesperada, solicitud especial

**Buenas practicas de documentacion:**

Escribe notas claras, objetivas y en tiempo real. No uses lenguaje subjetivo como "el residente parece triste" — en su lugar, documenta lo observable: "El residente no participo en la actividad grupal y permanecio en silencio durante el almuerzo." La diferencia es que lo observable es verificable y util clinicamente.

**Override Forzado:**

Si necesitas registrar una accion fuera del flujo normal (por ejemplo, documentar un medicamento administrado tarde), Zendity te pedira un **Override Forzado**. Esto requiere ingresar tu PIN y un motivo obligatorio. El Override queda marcado en el sistema para revision del supervisor.

PREGUNTAS:
P: Que es el Daily Log en Zendity?
a) Un resumen automatico generado por el sistema
b) Un formulario que solo llena la enfermera
*c) La herramienta de documentacion continua del cuidador durante el turno
d) Un reporte mensual de rendimiento
EXPLICACION: El Daily Log es donde el cuidador documenta continuamente observaciones, actividades y eventos durante su turno. Cada nota se convierte en parte del expediente oficial del residente.

P: Cual es la forma correcta de documentar un cambio de animo del residente?
a) "El residente esta deprimido y triste"
b) "Creo que el residente no se siente bien emocionalmente"
*c) "El residente no participo en la actividad grupal y permanecio en silencio durante el almuerzo"
d) "El residente tuvo un mal dia"
EXPLICACION: La documentacion debe ser objetiva y observable. "No participo y permanecio en silencio" es verificable, mientras que "esta triste" es subjetivo y no util clinicamente.

P: Que es un Override Forzado en Zendity?
a) Una funcion para eliminar registros erroneos
*b) Un mecanismo para registrar acciones fuera del flujo normal que requiere PIN y motivo obligatorio
c) Una herramienta para cambiar ordenes medicas sin autorizacion
d) Un boton para reiniciar el sistema
EXPLICACION: El Override Forzado permite registrar acciones fuera del flujo normal (como un medicamento administrado tarde). Requiere PIN y un motivo obligatorio, y queda marcado para revision del supervisor.

P: Quien puede ver las notas que el cuidador escribe en el Daily Log?
a) Solo el cuidador que las escribio
b) Solo la familia del residente
*c) Enfermeras, supervisores y reguladores en caso de auditorias
d) Unicamente el administrador de la Sede
EXPLICACION: Las notas del Daily Log son parte del expediente oficial. Son visibles para enfermeras, supervisores y, en caso de auditorias, para reguladores que revisen el cumplimiento de la facilidad.

P: En que momento debe el cuidador escribir sus notas en el Daily Log?
a) Al final del turno, cuando tenga tiempo libre
b) Una vez a la semana en un resumen
*c) En tiempo real, en el momento que ocurre la observacion o evento
d) Solo cuando el supervisor lo solicita
EXPLICACION: Las notas deben escribirse en tiempo real para garantizar precision. Documentar al final del turno aumenta el riesgo de omisiones y errores en los detalles.

---SECCION_5---
LECTURA:
# Cierre de Turno y Handover

El cierre de turno es tan importante como el inicio. Un turno bien cerrado protege a los residentes, protege al cuidador saliente y prepara al entrante para un turno exitoso. Zendity estructura este proceso para que nada quede pendiente.

**Checklist de cierre de turno:**

1. **Verificar medicamentos**: Confirma que todos los medicamentos programados para tu turno estan en estado ADMINISTRADO o tienen documentacion de por que no se administraron (RECHAZADO, MISSED con motivo)
2. **Completar Daily Log**: Asegurate de que todas tus observaciones estan registradas. No dejes notas pendientes "en tu cabeza"
3. **Resolver alertas**: Revisa si tienes alertas activas sin atender. Si no puedes resolverlas, escalala al supervisor antes de salir
4. **Preparar handover**: Zendity genera un resumen automatico de tu turno, pero debes revisarlo y agregar notas adicionales si algo no quedo capturado

**El handover en Zendity:**

El handover es la transferencia formal de responsabilidad entre turnos. Zendity facilita este proceso con un modulo dedicado que incluye:

- Resumen automatico de eventos del turno
- Lista de medicamentos MISSED y motivos
- Alertas activas pendientes
- Notas del cuidador saliente para el entrante

**Que pasa si no cierras tu turno:**

Si no completas el cierre de turno, Zendity genera una **sesion zombi** — una sesion que permanece abierta sin actividad. El supervisor recibe una alerta de sesion zombi y debe investigar. Las sesiones zombi son indicadores de problemas operativos y afectan el puntaje de cumplimiento.

PREGUNTAS:
P: Que es lo primero que debe verificar el cuidador al cerrar su turno?
*a) Que todos los medicamentos programados estan en estado ADMINISTRADO o tienen documentacion de por que no se dieron
b) Que el supervisor aprobo su salida
c) Que el dispositivo esta cargado
d) Que la familia fue notificada de cada actividad
EXPLICACION: Lo primero es verificar los medicamentos: todos deben estar en ADMINISTRADO o tener documentacion de motivo (RECHAZADO, MISSED). No deben quedar medicamentos sin estado definido.

P: Que es una sesion zombi?
a) Una sesion de entrenamiento nocturna
b) Un tipo de alerta para residentes con insomnio
*c) Una sesion que permanece abierta sin actividad porque el cuidador no cerro su turno
d) Un error del sistema que se corrige automaticamente
EXPLICACION: Una sesion zombi es una sesion que queda abierta sin actividad porque el cuidador no completo el cierre de turno. Genera una alerta al supervisor y afecta el cumplimiento.

P: Que genera Zendity automaticamente para facilitar el handover?
a) Un mensaje de texto al cuidador entrante
b) Una videollamada entre los dos turnos
*c) Un resumen automatico de eventos del turno con medicamentos MISSED, alertas y notas
d) Un formulario en blanco para llenar manualmente
EXPLICACION: Zendity genera un resumen automatico del turno que incluye eventos, medicamentos MISSED con motivos, alertas activas pendientes y notas del cuidador saliente.

P: Que debe hacer el cuidador si tiene alertas activas que no puede resolver antes de salir?
a) Ignorarlas porque el siguiente turno las vera
b) Eliminarlas del sistema para limpiar su pantalla
*c) Escalarlas al supervisor antes de salir del turno
d) Resolverlas rapidamente sin importar la calidad
EXPLICACION: Las alertas activas que no se pueden resolver deben escalarse al supervisor antes de terminar el turno. No deben ignorarse ni resolverse apresuradamente sin calidad.

P: Por que las sesiones zombi son un problema operativo?
a) Porque consumen mucha bateria en el dispositivo
*b) Porque indican que un turno no fue cerrado correctamente, afectando la continuidad del cuidado y el cumplimiento
c) Porque el sistema deja de funcionar para todos los usuarios
d) Porque generan costos adicionales de licencia
EXPLICACION: Las sesiones zombi indican un cierre de turno incompleto, lo que afecta la continuidad del cuidado (informacion no transferida), el cumplimiento regulatorio y el puntaje operativo de la facilidad.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 9: EL SUPERVISOR EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'SUPERVISOR_101',
    title: 'El Supervisor en Zendity',
    description: 'Domina las herramientas de supervision en tiempo real: dashboard, sesiones zombi, MISSED y redistribucion de personal.',
    durationMins: 30,
    bonusCompliance: 10,
    emoji: '👁️',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: El Supervisor en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende las responsabilidades del supervisor en Zendity, incluyendo monitoreo en tiempo real, deteccion de sesiones zombi, y gestion de MISSED.
TERMINOS_CLAVE: dashboard supervision, sesion zombi, MISSED en tiempo real, Override Forzado, Triage Center, handover pendiente, redistribucion de color, digest, ausencia, cierre administrativo
PREGUNTA_REFLEXION: Son las 3pm. Ves en el dashboard 2 sesiones zombi y 5 MISSED sin resolver. El turno vespertino llega en 1 hora. Que haces?

---SECCION_1---
LECTURA:
# El Rol del Supervisor en Zendity

El supervisor es el eje operativo de la facilidad. Mientras los cuidadores estan enfocados en sus residentes asignados y las enfermeras en las decisiones clinicas, el supervisor tiene la vision panoramica de todo lo que ocurre en el piso de cuido en tiempo real.

**Responsabilidades clave del supervisor en Zendity:**

- **Monitoreo continuo**: Vigilar que todos los cuidadores esten activos, que los medicamentos se administren a tiempo y que no haya alertas sin atender
- **Deteccion de anomalias**: Identificar sesiones zombi, MISSED acumulados, handovers incompletos y cuidadores sin actividad
- **Escalado inteligente**: Decidir cuando un problema operativo se convierte en un evento que requiere la intervencion del director o el Triage Center
- **Redistribucion de personal**: Reasignar residentes entre cuidadores cuando hay ausencias, emergencias o sobrecarga

**La diferencia entre supervisar y micro-gestionar:**

Zendity le da al supervisor datos objetivos en tiempo real. El dashboard no esta disenado para vigilar a los empleados constantemente, sino para detectar problemas temprano y actuar antes de que se conviertan en incidentes. Un buen supervisor usa los datos para apoyar a su equipo, no para castigarlo.

PREGUNTAS:
P: Cual es la funcion principal del supervisor en Zendity?
a) Administrar medicamentos a los residentes
b) Crear ordenes medicas y planes de tratamiento
*c) Tener la vision panoramica del piso de cuido y monitorear operaciones en tiempo real
d) Gestionar la nomina y los beneficios del personal
EXPLICACION: El supervisor tiene la vision panoramica de toda la operacion del piso de cuido: monitorea cuidadores activos, medicamentos, alertas y detecta anomalias en tiempo real.

P: Que tipo de anomalias debe detectar el supervisor?
a) Solo errores de facturacion
*b) Sesiones zombi, MISSED acumulados, handovers incompletos y cuidadores sin actividad
c) Unicamente problemas de infraestructura del edificio
d) Solo quejas de familiares
EXPLICACION: El supervisor debe detectar anomalias operativas como sesiones zombi, medicamentos MISSED acumulados, handovers incompletos y cuidadores que no registran actividad.

P: Cuando debe el supervisor escalar un problema al director o Triage Center?
a) Nunca, el supervisor resuelve todo solo
b) Solo cuando un familiar se queja
*c) Cuando un problema operativo se convierte en un evento que requiere intervencion de nivel superior
d) Al final de cada turno como rutina
EXPLICACION: El escalado inteligente implica que el supervisor evalua cuando un problema supera su capacidad de resolucion y necesita intervencion del director o del Triage Center.

P: Como debe usar el supervisor los datos del dashboard?
a) Para castigar a los empleados con bajo rendimiento
b) Para generar reportes financieros
*c) Para detectar problemas temprano y apoyar al equipo antes de que se conviertan en incidentes
d) Para compartir estadisticas en redes sociales
EXPLICACION: El dashboard proporciona datos objetivos para detectar problemas temprano y actuar proactivamente. Supervisar no es micro-gestionar sino apoyar al equipo con informacion.

P: Que puede hacer el supervisor cuando hay ausencias o emergencias?
a) Cancelar el turno completo
b) Enviar a todos los residentes al hospital
*c) Redistribuir residentes entre cuidadores disponibles reasignando grupos de color
d) Esperar hasta el proximo turno para resolver
EXPLICACION: El supervisor puede redistribuir residentes entre cuidadores disponibles, reasignando grupos de color para cubrir ausencias o emergencias sin dejar residentes sin atencion.

---SECCION_2---
LECTURA:
# Dashboard de Supervision en Tiempo Real

El dashboard de supervision es el centro de control del supervisor. Esta disenado para mostrar el estado operativo completo de la facilidad en una sola pantalla, con indicadores visuales que permiten identificar problemas en segundos.

**Paneles principales del dashboard:**

- **Panel de sesiones activas**: Muestra cuantos cuidadores estan conectados, hace cuanto iniciaron sesion y su ultimo registro de actividad. Las sesiones inactivas por mas de 30 minutos se marcan en amarillo
- **Panel de medicamentos**: Vista en tiempo real del estado de todos los medicamentos programados — PENDIENTE, LISTO, ADMINISTRADO, MISSED. Los MISSED se destacan en rojo con contador de tiempo
- **Panel de alertas**: Todas las alertas activas del piso — caidas, eventos clinicos, solicitudes de residentes. Se ordenan por prioridad
- **Panel de handover**: Estado de los handovers pendientes entre turnos. Muestra si hay informacion sin transferir

**El digest del supervisor:**

Cada 4 horas, Zendity genera un **digest** automatico — un resumen ejecutivo del estado de la facilidad. El digest incluye: numero de MISSED acumulados, sesiones zombi detectadas, alertas resueltas versus pendientes, y cualquier evento escalado. El supervisor puede configurar si recibe el digest como notificacion push o solo en pantalla.

**Indicadores de color en el dashboard:**

- **Verde**: Todo en orden, sin acciones requeridas
- **Amarillo**: Atencion necesaria pronto — sesion inactiva, medicamento proximo a vencer su ventana
- **Rojo**: Accion inmediata requerida — MISSED activo, sesion zombi, alerta critica sin atender

PREGUNTAS:
P: Despues de cuanto tiempo de inactividad se marca una sesion en amarillo?
a) 10 minutos
b) 15 minutos
*c) 30 minutos
d) 1 hora
EXPLICACION: Las sesiones de cuidadores que no registran actividad por mas de 30 minutos se marcan en amarillo, alertando al supervisor de una posible anomalia.

P: Que es el digest del supervisor?
a) Un examen que el supervisor debe completar cada turno
b) Un formulario de asistencia del personal
*c) Un resumen ejecutivo automatico del estado de la facilidad generado cada 4 horas
d) Un reporte financiero mensual
EXPLICACION: El digest es un resumen automatico que Zendity genera cada 4 horas con MISSED acumulados, sesiones zombi, alertas y eventos escalados para mantener al supervisor informado.

P: Que indica el color rojo en los indicadores del dashboard?
a) Que es horario de almuerzo
b) Que todo esta funcionando correctamente
*c) Que se requiere accion inmediata — MISSED activo, sesion zombi o alerta critica
d) Que el sistema esta en mantenimiento
EXPLICACION: El rojo indica accion inmediata requerida: puede ser un MISSED activo, una sesion zombi o una alerta critica sin atender. El supervisor debe actuar sin demora.

P: Que informacion muestra el panel de handover?
a) Los salarios de los empleados del turno
b) Las calificaciones de los cursos de Academy
*c) El estado de los handovers pendientes y si hay informacion sin transferir entre turnos
d) Los horarios de visita de familiares
EXPLICACION: El panel de handover muestra el estado de las transferencias entre turnos, incluyendo si hay informacion pendiente de comunicar del turno saliente al entrante.

P: Como puede el supervisor recibir el digest?
a) Solo por correo electronico
b) Solo en la pantalla del dashboard
*c) Como notificacion push o en pantalla, segun su configuracion
d) Unicamente por mensaje de texto
EXPLICACION: El supervisor puede configurar si recibe el digest como notificacion push en su dispositivo o solo visible en la pantalla del dashboard, segun su preferencia.

---SECCION_3---
LECTURA:
# Sesiones Zombi y MISSED

Las sesiones zombi y los medicamentos MISSED son los dos problemas operativos mas criticos que el supervisor debe gestionar diariamente. Ambos son indicadores de fallas en el flujo de trabajo que pueden comprometer la seguridad del residente.

**Sesiones zombi — Deteccion y resolucion:**

Una sesion zombi se genera cuando un cuidador no cierra su turno correctamente. El dashboard muestra las sesiones zombi con un icono especifico y la hora del ultimo registro de actividad. El supervisor debe:

1. Contactar al cuidador para verificar si aun esta en la facilidad
2. Si el cuidador ya se fue, cerrar la sesion administrativamente ingresando su PIN de supervisor y un motivo
3. Revisar si el cuidador completo su handover. Si no, el supervisor debe completar la informacion faltante
4. Documentar la sesion zombi como incidencia operativa

**MISSED en tiempo real — Protocolo de resolucion:**

Cuando un medicamento aparece como MISSED, el supervisor tiene responsabilidades especificas:

1. Verificar por que no se administro — fue rechazo del residente, ausencia del cuidador, error de horario?
2. Contactar a la enfermera de turno para determinar si el medicamento debe administrarse tarde o se omite
3. Si la enfermera autoriza administracion tardia, el cuidador usa Override Forzado con el motivo documentado
4. Si se decide omitir, la enfermera documenta la razon clinica en el eMAR

Ningun MISSED debe quedar sin resolucion al final del turno.

PREGUNTAS:
P: Que debe hacer el supervisor cuando detecta una sesion zombi?
a) Ignorarla porque se cerrara sola
b) Eliminar la cuenta del cuidador
*c) Contactar al cuidador, cerrar la sesion administrativamente si es necesario y revisar el handover
d) Reiniciar todo el sistema
EXPLICACION: El supervisor debe contactar al cuidador, cerrar la sesion con su PIN de supervisor si el cuidador ya no esta, y verificar que el handover este completo.

P: Que se necesita para cerrar administrativamente una sesion zombi?
a) Solo hacer clic en un boton de cerrar
b) La contrasena del cuidador que dejo la sesion abierta
*c) El PIN del supervisor y un motivo documentado
d) Autorizacion del director por escrito
EXPLICACION: El cierre administrativo de una sesion zombi requiere el PIN del supervisor y un motivo obligatorio, creando un registro auditable de la accion.

P: Cual es el primer paso cuando un medicamento aparece como MISSED?
*a) Verificar por que no se administro — rechazo, ausencia, error de horario
b) Administrar el medicamento inmediatamente sin consultar
c) Notificar a la familia del residente
d) Reportar al cuidador a recursos humanos
EXPLICACION: Lo primero es investigar la causa del MISSED: pudo ser rechazo del residente, ausencia del cuidador o un error de horario. La causa determina la accion correctiva.

P: Quien decide si un medicamento MISSED se administra tarde o se omite?
a) El cuidador asignado al residente
b) El supervisor de turno
*c) La enfermera de turno
d) El familiar del residente
EXPLICACION: La decision clinica de administrar un medicamento tarde o omitirlo corresponde a la enfermera de turno, quien tiene la autoridad clinica para evaluar el impacto.

P: Que debe ocurrir con los MISSED al final de cada turno?
a) Se eliminan automaticamente del sistema
b) Se transfieren al siguiente turno sin resolucion
*c) Ningun MISSED debe quedar sin resolucion — todos deben tener accion documentada
d) Se reportan a la aseguradora directamente
EXPLICACION: Todo MISSED debe resolverse antes del cierre de turno: ya sea con administracion tardia documentada o con omision justificada por la enfermera. Ninguno queda pendiente.

---SECCION_4---
LECTURA:
# Triage Center y Escalado

El **Triage Center** es el modulo de Zendity donde convergen todos los eventos que requieren decision de nivel superior. El supervisor es el guardavias del Triage Center: evalua cada evento entrante y decide la ruta de accion.

**Eventos que llegan al Triage Center:**

- Caidas clasificadas como ALTO o CRITICO
- Multiples MISSED del mismo residente en un turno
- Alertas clinicas escaladas por enfermeras (cambios en signos vitales, comportamiento erratico)
- Eventos de seguridad (residente fuera de area asignada, visitante no autorizado)
- Solicitudes de Override Forzado que el supervisor debe aprobar o investigar

**Flujo de decision en el Triage Center:**

Cada evento en el Triage Center tiene tres opciones de accion:

1. **Resolver localmente**: El supervisor toma la accion necesaria y documenta la resolucion
2. **Escalar al director**: El evento requiere autorizacion o recursos que superan la capacidad del supervisor
3. **Activar protocolo de emergencia**: Para situaciones criticas que requieren 911 o respuesta de emergencia externa

**Notificacion familiar desde el Triage Center:**

El supervisor puede activar la notificacion familiar directamente desde el Triage Center para eventos que lo ameriten. La notificacion se envia al portal familiar con un mensaje estructurado que incluye: que ocurrio, que accion se tomo y quien es el contacto de seguimiento. Toda notificacion queda registrada en el expediente.

PREGUNTAS:
P: Que es el Triage Center en Zendity?
a) Un area fisica en la facilidad para emergencias medicas
*b) El modulo donde convergen todos los eventos que requieren decision de nivel superior
c) Un curso de capacitacion en primeros auxilios
d) El area de recepcion para visitantes
EXPLICACION: El Triage Center es un modulo digital en Zendity donde llegan todos los eventos que requieren evaluacion y decision del supervisor o niveles superiores.

P: Cuales son las tres opciones de accion para cada evento en el Triage Center?
a) Eliminar, archivar o reenviar
b) Aprobar, denegar o posponer
*c) Resolver localmente, escalar al director o activar protocolo de emergencia
d) Leer, responder o ignorar
EXPLICACION: Cada evento tiene tres rutas: resolucion local por el supervisor, escalado al director si supera su capacidad, o activacion de protocolo de emergencia para situaciones criticas.

P: Que tipo de evento llega al Triage Center por multiples MISSED?
a) Solo si hay mas de 20 MISSED en toda la facilidad
*b) Cuando un mismo residente tiene multiples MISSED en un solo turno
c) Solo los MISSED de medicamentos controlados
d) Unicamente los MISSED del turno de noche
EXPLICACION: Multiples MISSED del mismo residente en un turno es una senal de alerta que llega al Triage Center porque indica un posible fallo sistematico en la atencion de ese residente.

P: Que informacion incluye la notificacion familiar enviada desde el Triage Center?
a) Solo que hubo un incidente, sin detalles
b) El historial medico completo del residente
*c) Que ocurrio, que accion se tomo y quien es el contacto de seguimiento
d) Una copia de todos los medicamentos del residente
EXPLICACION: La notificacion familiar es estructurada e incluye tres elementos clave: que paso, que se hizo al respecto y quien es la persona de contacto para seguimiento.

P: Que debe hacer el supervisor con una solicitud de Override Forzado que llega al Triage Center?
a) Aprobarla automaticamente para no retrasar el cuidado
b) Rechazarla siempre por seguridad
*c) Evaluar el contexto, aprobarla o investigarla segun la situacion
d) Reenviarla al director sin revisarla
EXPLICACION: El supervisor debe evaluar cada Override Forzado en contexto: verificar el motivo, la validez de la accion y decidir si aprueba o si requiere investigacion adicional.

---SECCION_5---
LECTURA:
# Redistribucion de Color y Cierre Administrativo

La **redistribucion de color** es una de las herramientas mas poderosas del supervisor. Permite reasignar residentes entre cuidadores en tiempo real cuando las condiciones del turno cambian — ya sea por ausencias, emergencias o desbalance en la carga de trabajo.

**Cuando redistribuir:**

- Un cuidador no se presento al turno y no hay reemplazo inmediato
- Un cuidador tiene una emergencia personal y debe salir antes de terminar su turno
- Un grupo de color tiene significativamente mas carga (residentes con necesidades complejas) que los demas
- Un evento critico (caida, hospitalizacion) requiere que un cuidador acompane a un residente fuera de la facilidad

**Como redistribuir en Zendity:**

1. Accede al modulo de asignacion desde el dashboard
2. Selecciona el grupo de color que necesita redistribucion
3. Arrastra residentes al grupo del cuidador que recibira la carga adicional
4. Confirma con tu PIN de supervisor — el cambio se refleja inmediatamente en el /care de cada cuidador

**Cierre administrativo del turno:**

Al final de cada turno, el supervisor debe realizar un cierre administrativo que incluye: verificar que no hay sesiones zombi pendientes, confirmar que todos los handovers se completaron, revisar el digest final del turno y firmar digitalmente con su PIN. El cierre administrativo es evidencia de que el supervisor superviso activamente el turno completo.

PREGUNTAS:
P: Que es la redistribucion de color?
a) Cambiar el esquema de colores de la interfaz
b) Pintar las habitaciones de los residentes
*c) Reasignar residentes entre cuidadores en tiempo real cuando cambian las condiciones del turno
d) Un proceso de seleccion de uniformes
EXPLICACION: La redistribucion de color permite al supervisor reasignar residentes entre cuidadores disponibles cuando hay ausencias, emergencias o desbalance de carga de trabajo.

P: En cual de estas situaciones debe el supervisor redistribuir?
a) Cuando un residente pide cambiar de cuidador por preferencia
*b) Cuando un cuidador no se presento al turno y no hay reemplazo inmediato
c) Cuando el supervisor quiere variar la rutina del equipo
d) Cuando hay visita de familiares en la facilidad
EXPLICACION: La redistribucion es necesaria cuando un cuidador falta y no hay reemplazo, asegurando que ningun residente quede sin cuidador asignado.

P: Que se necesita para confirmar una redistribucion de residentes?
a) Solo arrastrar los nombres en la pantalla
b) La aprobacion escrita del director
*c) El PIN del supervisor para confirmar el cambio
d) Una reunion con todos los cuidadores del turno
EXPLICACION: La redistribucion requiere confirmacion con el PIN del supervisor, creando un registro auditable del cambio. El cambio se refleja inmediatamente en el /care de cada cuidador.

P: Que incluye el cierre administrativo del turno del supervisor?
a) Solo cerrar sesion en el sistema
b) Enviar un correo al director resumiendo el turno
*c) Verificar sesiones zombi, confirmar handovers, revisar digest final y firmar digitalmente con PIN
d) Apagar todos los dispositivos de la facilidad
EXPLICACION: El cierre administrativo incluye verificar que no hay sesiones zombi, que todos los handovers se completaron, revisar el digest final y firmar con PIN como evidencia de supervision activa.

P: Por que el cierre administrativo es importante como evidencia?
a) Porque genera un bono salarial automatico
b) Porque desbloquea funciones adicionales del sistema
*c) Porque demuestra que el supervisor superviso activamente todo el turno completo
d) Porque es necesario para que el proximo turno inicie sesion
EXPLICACION: El cierre administrativo firmado con PIN es evidencia oficial de que el supervisor monitoreo activamente el turno completo, lo cual es relevante para auditorias y cumplimiento regulatorio.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 10: LA ENFERMERA EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ENFERMERA_101',
    title: 'La Enfermera en Zendity',
    description: 'Guia del rol de enfermeria en Zendity: autoridad clinica, medicamentos HELD, escalas de evaluacion y protocolos.',
    durationMins: 30,
    bonusCompliance: 10,
    emoji: '🩺',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: La Enfermera en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende la autoridad clinica de enfermeria en Zendity, incluyendo el manejo de HELD, escalas de evaluacion y protocolos de escalado.
TERMINOS_CLAVE: HELD, Escala Downton, Escala Braden, handover clinico, UPP, medicamento controlado, doble verificacion, autoridad clinica, /nursing, protocolo de caida
PREGUNTA_REFLEXION: Un residente lleva 3 dias rechazando el mismo medicamento. El cuidador lo registro como REFUSED cada vez. Cual es tu rol como enfermera en Zendity?

---SECCION_1---
LECTURA:
# El Rol de Enfermeria en Zendity

En Zendity, la enfermera es la maxima autoridad clinica dentro de la facilidad de cuido. Mientras el cuidador ejecuta tareas diarias y registra observaciones, la enfermera supervisa, evalua y toma decisiones clinicas que impactan directamente la seguridad del residente.

**Responsabilidades principales:**

- **Supervision del eMAR**: Revisar que los medicamentos se administren correctamente y que los registros esten completos al final de cada turno.
- **Evaluaciones clinicas**: Aplicar escalas estandarizadas (Downton, Braden) para medir riesgos y documentar hallazgos.
- **Escalado de alertas**: Cuando un cuidador reporta un cambio en el estado del residente, la enfermera decide si se necesita intervencion medica externa.
- **Coordinacion con el medico**: Comunicar hallazgos y recibir ordenes actualizadas.

El modulo **/nursing** en Zendity centraliza todas estas funciones. Desde ahi puedes ver alertas pendientes, revisar historiales y generar reportes clinicos. La enfermera no solo reacciona a problemas — anticipa riesgos usando datos del sistema.

PREGUNTAS:
P: Cual es el rol principal de la enfermera dentro de Zendity?
a) Administrar medicamentos en lugar del cuidador
*b) Ser la maxima autoridad clinica que supervisa, evalua y toma decisiones clinicas
c) Gestionar los turnos del personal de la facilidad
d) Registrar las comidas diarias de cada residente
EXPLICACION: La enfermera es la maxima autoridad clinica en la facilidad. Supervisa el trabajo del cuidador, toma decisiones clinicas y escala situaciones cuando es necesario.

P: Que modulo centraliza las funciones de enfermeria en Zendity?
a) Care Floor Dashboard
b) CRM
*c) /nursing
d) Academy
EXPLICACION: El modulo /nursing centraliza alertas pendientes, historiales clinicos y reportes, dando a la enfermera una vista completa de la situacion clinica.

P: Que debe hacer la enfermera cuando un cuidador reporta un cambio en el estado de un residente?
a) Ignorar el reporte si no parece urgente
b) Pedirle al cuidador que lo maneje solo
*c) Evaluar la situacion y decidir si se necesita intervencion medica externa
d) Esperar al siguiente turno para revisarlo
EXPLICACION: La enfermera evalua cada cambio reportado y decide el nivel de intervencion necesario, incluyendo la posibilidad de escalar a un medico externo.

P: Que diferencia al cuidador de la enfermera en Zendity?
*a) El cuidador ejecuta tareas diarias; la enfermera supervisa y toma decisiones clinicas
b) El cuidador tiene mas acceso al sistema que la enfermera
c) No hay diferencia, ambos tienen el mismo rol
d) La enfermera solo trabaja en el turno de noche
EXPLICACION: El cuidador registra observaciones y ejecuta el plan diario, mientras la enfermera supervisa esas acciones, evalua riesgos y toma decisiones clinicas.

P: Ademas de reaccionar a problemas, que hace la enfermera en Zendity?
a) Solo espera que el cuidador reporte situaciones
b) Delega todas las evaluaciones al medico externo
*c) Anticipa riesgos usando datos del sistema
d) Registra unicamente notas administrativas
EXPLICACION: La enfermera usa los datos de Zendity para anticipar riesgos antes de que se conviertan en emergencias, aplicando escalas de evaluacion y revisando tendencias.

---SECCION_2---
LECTURA:
# Autoridad Clinica y Medicamentos HELD

Uno de los escenarios mas criticos en enfermeria es el manejo de medicamentos con status HELD. Un medicamento HELD es aquel que ha sido temporalmente suspendido por una razon clinica valida. Solo la enfermera tiene la autoridad para colocar o liberar un HELD en Zendity.

**Cuando se coloca un HELD:**

- El residente presenta efectos adversos al medicamento
- Signos vitales fuera de rango seguro antes de administrar (ej. presion arterial muy baja para un antihipertensivo)
- El residente esta en ayunas por un procedimiento programado
- Orden medica nueva que contradice el medicamento actual

**Proceso de HELD en Zendity:**

1. La enfermera accede al eMAR del residente
2. Selecciona el medicamento y cambia su status a HELD
3. Registra la razon clinica obligatoria en el campo de justificacion
4. El sistema bloquea la administracion de ese medicamento para los cuidadores
5. La enfermera revisa diariamente los HELD activos y decide si reactivar

**Doble verificacion en controlados:** Para medicamentos controlados (narcoticos, benzodiacepinas), Zendity requiere doble verificacion: dos personas deben confirmar la dosis antes de administrar. Esta regla aplica siempre, sin excepciones.

PREGUNTAS:
P: Quien tiene autoridad para colocar un medicamento en status HELD en Zendity?
a) Cualquier cuidador del turno
b) El administrador de la facilidad
*c) Solo la enfermera
d) El familiar del residente
EXPLICACION: Solo la enfermera tiene la autoridad clinica para colocar o liberar un HELD en Zendity, ya que requiere juicio clinico profesional.

P: Que sucede cuando un medicamento se marca como HELD en el eMAR?
a) Se elimina permanentemente del expediente
b) Se administra a mitad de dosis
*c) El sistema bloquea su administracion para los cuidadores
d) Se transfiere automaticamente a otro residente
EXPLICACION: Cuando un medicamento esta en HELD, Zendity bloquea la administracion para los cuidadores hasta que la enfermera decida reactivarlo.

P: Cual de estas es una razon valida para colocar un HELD?
a) El cuidador no encuentra el medicamento en el gabinete
*b) El residente presenta signos vitales fuera de rango seguro
c) El familiar solicito que no se administre
d) Es fin de semana y hay menos personal
EXPLICACION: Signos vitales fuera de rango seguro (como presion arterial muy baja para un antihipertensivo) es una razon clinica valida para suspender temporalmente un medicamento.

P: Que requiere Zendity para administrar medicamentos controlados?
a) Autorizacion escrita del Director
b) Que el residente firme un consentimiento cada vez
*c) Doble verificacion: dos personas deben confirmar la dosis
d) Que sea horario diurno unicamente
EXPLICACION: Los medicamentos controlados requieren doble verificacion en Zendity — dos personas confirman la dosis antes de administrar, sin excepciones.

P: Con que frecuencia debe la enfermera revisar los medicamentos en HELD?
a) Una vez al mes
b) Solo cuando el medico lo solicite
*c) Diariamente
d) Al final de la semana
EXPLICACION: La enfermera debe revisar diariamente los HELD activos para evaluar si las condiciones clinicas han cambiado y el medicamento puede reactivarse.

---SECCION_3---
LECTURA:
# Escalas Downton y Braden

Las escalas de evaluacion clinica son herramientas estandarizadas que permiten medir riesgos de forma objetiva. En Zendity, dos escalas son fundamentales para enfermeria: la Escala Downton y la Escala Braden.

**Escala Downton — Riesgo de Caidas:**

La Escala Downton mide el riesgo de caida de un residente evaluando factores como historial de caidas previas, uso de medicamentos sedantes, deficit sensorial, estado mental y capacidad de marcha. Un puntaje de 3 o mas indica riesgo alto de caida.

Cuando un residente tiene puntaje alto en Downton, la enfermera debe activar el protocolo de prevencion de caidas: barandas, asistencia en traslados, iluminacion adecuada y notificacion al equipo de cuidadores.

**Escala Braden — Riesgo de Ulceras por Presion (UPP):**

La Escala Braden evalua el riesgo de desarrollar ulceras por presion midiendo percepcion sensorial, humedad, actividad, movilidad, nutricion y friccion. Un puntaje menor a 18 indica riesgo — mientras mas bajo, mayor el riesgo.

Zendity integra ambas escalas en el modulo /nursing. La enfermera las aplica durante la evaluacion inicial y las reevalua periodicamente. Los resultados alimentan alertas automaticas que notifican cuando un residente cruza el umbral de riesgo.

PREGUNTAS:
P: Que mide la Escala Downton?
a) El nivel de dolor del residente
*b) El riesgo de caida del residente
c) La calidad de la nutricion diaria
d) El cumplimiento de medicamentos
EXPLICACION: La Escala Downton mide el riesgo de caida evaluando factores como caidas previas, medicamentos sedantes, deficit sensorial y capacidad de marcha.

P: A partir de que puntaje en la Escala Downton se considera riesgo alto de caida?
a) 1 o mas
b) 2 o mas
*c) 3 o mas
d) 5 o mas
EXPLICACION: Un puntaje de 3 o mas en la Escala Downton indica riesgo alto de caida y requiere activar el protocolo de prevencion.

P: Que mide la Escala Braden?
a) El riesgo de infecciones respiratorias
b) La capacidad cognitiva del residente
*c) El riesgo de desarrollar ulceras por presion (UPP)
d) El nivel de satisfaccion del residente
EXPLICACION: La Escala Braden evalua el riesgo de ulceras por presion midiendo factores como percepcion sensorial, humedad, movilidad, nutricion y friccion.

P: En la Escala Braden, un puntaje menor a 18 indica:
a) Que el residente esta completamente sano
b) Que se puede reducir la frecuencia de evaluaciones
*c) Riesgo de desarrollar ulceras por presion
d) Que el residente necesita mas medicamentos
EXPLICACION: En la Escala Braden, un puntaje menor a 18 indica riesgo de UPP. Mientras mas bajo el puntaje, mayor es el riesgo.

P: Donde se integran las Escalas Downton y Braden en Zendity?
a) En el CRM de admisiones
b) En el modulo Academy
*c) En el modulo /nursing
d) En el portal familiar
EXPLICACION: Ambas escalas estan integradas en el modulo /nursing, donde la enfermera las aplica, reevalua periodicamente y recibe alertas automaticas.

---SECCION_4---
LECTURA:
# UPP y Protocolos de Prevencion

Las Ulceras por Presion (UPP) son lesiones en la piel y tejidos causadas por presion prolongada, especialmente en residentes con movilidad reducida. En facilidades de cuido, prevenir UPP es una responsabilidad critica de enfermeria.

**Clasificacion de UPP por estadios:**

- **Estadio I**: Piel intacta con enrojecimiento que no palidece al presionar. Es la primera senal de alerta.
- **Estadio II**: Perdida parcial de piel. Puede verse como una ampolla o abrasion superficial.
- **Estadio III**: Perdida total del espesor de la piel. El tejido subcutaneo puede estar visible.
- **Estadio IV**: Perdida total del espesor con exposicion de musculo, hueso o tendon.

**Protocolo de prevencion en Zendity:**

1. Aplicar la Escala Braden al ingreso y reevaluar semanalmente
2. Documentar hallazgos en el modulo /nursing con fotos si es necesario
3. Activar cambios de posicion cada 2 horas para residentes de alto riesgo
4. Registrar cada cambio de posicion en el sistema para trazabilidad
5. Coordinar con nutricion para asegurar ingesta adecuada de proteinas y liquidos

Cuando se detecta una UPP, la enfermera debe documentar el estadio, ubicacion y tamano, notificar al medico y establecer un plan de curacion con seguimiento diario en Zendity.

PREGUNTAS:
P: Que es una ulcera por presion (UPP)?
a) Una reaccion alergica a medicamentos
*b) Una lesion en la piel causada por presion prolongada en residentes con movilidad reducida
c) Una infeccion causada por falta de higiene
d) Un efecto secundario de la nutricion inadecuada
EXPLICACION: Las UPP son lesiones causadas por presion prolongada sobre la piel, especialmente en areas oseas de residentes con movilidad reducida.

P: Cual es la primera senal de alerta de una UPP (Estadio I)?
*a) Piel intacta con enrojecimiento que no palidece al presionar
b) Ampolla o abrasion superficial
c) Exposicion de musculo o hueso
d) Perdida total del espesor de la piel
EXPLICACION: El Estadio I se caracteriza por piel intacta con enrojecimiento persistente que no palidece, indicando dano por presion inicial.

P: Con que frecuencia se deben reevaluar las escalas de riesgo de UPP?
a) Una vez al ano
b) Solo al momento de la admision
*c) Semanalmente
d) Cada 6 meses
EXPLICACION: La Escala Braden se aplica al ingreso y se reevalua semanalmente para detectar cambios en el nivel de riesgo del residente.

P: Cada cuantas horas se deben realizar cambios de posicion en residentes de alto riesgo?
a) Cada 6 horas
*b) Cada 2 horas
c) Una vez al dia
d) Solo cuando el residente lo solicite
EXPLICACION: Los cambios de posicion cada 2 horas son parte del protocolo estandar de prevencion de UPP en residentes de alto riesgo.

P: Que debe hacer la enfermera cuando detecta una UPP?
a) Esperar a la proxima evaluacion semanal para documentar
b) Aplicar tratamiento sin notificar al medico
*c) Documentar estadio, ubicacion y tamano, notificar al medico y crear un plan de curacion
d) Transferir al residente a otra facilidad inmediatamente
EXPLICACION: La deteccion de una UPP requiere documentacion inmediata del estadio, ubicacion y tamano, notificacion al medico y un plan de curacion con seguimiento diario.

---SECCION_5---
LECTURA:
# Handover Clinico y Coordinacion

El handover clinico es la transferencia estructurada de informacion entre turnos de enfermeria. En Zendity, un handover incompleto puede resultar en medicamentos omitidos, alertas ignoradas o cambios clinicos no detectados.

**Componentes del handover en Zendity:**

- **Medicamentos HELD activos**: Revisar cada HELD, la razon y si requiere reevaluacion
- **Alertas pendientes**: Eventos que necesitan seguimiento (caidas, cambios de condicion, rechazos de medicamentos)
- **Escalas recientes**: Resultados de Downton y Braden que requieren accion
- **Notas clinicas del turno**: Observaciones relevantes documentadas por cuidadores y enfermeras

**Protocolo de handover:**

1. La enfermera saliente revisa su lista de pendientes en /nursing
2. Comunica verbalmente los casos criticos a la enfermera entrante
3. La enfermera entrante verifica en el sistema que toda la informacion coincide
4. Ambas firman digitalmente el handover en Zendity

**Coordinacion con el equipo:**

La enfermera coordina con cuidadores asignandoles tareas especificas por grupo de color. Si un residente necesita atencion especial (monitoreo post-caida, curacion de UPP), la enfermera lo comunica directamente al cuidador responsable y documenta la instruccion en el sistema. Esto crea trazabilidad completa de quien recibio la instruccion y cuando.

PREGUNTAS:
P: Que es el handover clinico en Zendity?
a) El proceso de admision de un nuevo residente
*b) La transferencia estructurada de informacion entre turnos de enfermeria
c) La evaluacion anual del desempenno del personal
d) El reporte mensual para el Director
EXPLICACION: El handover clinico es la transferencia de informacion critica entre la enfermera saliente y la entrante para asegurar continuidad del cuidado.

P: Que debe revisar la enfermera entrante durante el handover?
a) Solo los reportes financieros del turno anterior
b) Unicamente las notas del Director
*c) Medicamentos HELD, alertas pendientes, escalas recientes y notas clinicas
d) Solo la lista de residentes nuevos
EXPLICACION: Durante el handover se revisan HELD activos, alertas pendientes, resultados de escalas y notas clinicas para asegurar que ningun caso critico quede sin atencion.

P: Que sucede al finalizar el protocolo de handover en Zendity?
a) Se eliminan las notas del turno anterior
b) El sistema cierra automaticamente la sesion de ambas enfermeras
*c) Ambas enfermeras firman digitalmente el handover
d) Se genera un reporte para los familiares
EXPLICACION: El handover culmina con la firma digital de ambas enfermeras en Zendity, creando un registro de trazabilidad de la transferencia.

P: Como asigna tareas la enfermera a los cuidadores?
a) Mediante mensajes de texto personales
b) Dejando notas en papel en el escritorio
*c) Asignando tareas por grupo de color y documentando la instruccion en el sistema
d) Verbalmente sin ningun registro
EXPLICACION: La enfermera asigna tareas por grupo de color y documenta cada instruccion en Zendity, creando trazabilidad de quien recibio la indicacion y cuando.

P: Por que un handover incompleto es peligroso?
a) Porque genera multas automaticas del sistema
*b) Porque puede resultar en medicamentos omitidos, alertas ignoradas o cambios no detectados
c) Porque el Director recibe una notificacion negativa
d) Porque el turno entrante no puede iniciar sesion
EXPLICACION: Un handover incompleto compromete la seguridad del residente. Medicamentos pueden omitirse, alertas pueden ignorarse y cambios clinicos pueden pasar desapercibidos.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 11: EL DIRECTOR EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'DIRECTOR_101',
    title: 'El Director en Zendity',
    description: 'Vision ejecutiva de Zendity para directores: activacion clinica, compliance, CRM y supervision remota.',
    durationMins: 35,
    bonusCompliance: 10,
    emoji: '🏛️',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: El Director en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende las responsabilidades del Director en Zendity, incluyendo activacion clinica, monitoreo de compliance y uso del CRM para admisiones.
TERMINOS_CLAVE: activacion clinica, DORMANT, grupo de color, PAI, CRM, pipeline de admisiones, complianceScore, digest ejecutivo, supervision remota, HIPAA
PREGUNTA_REFLEXION: Un familiar llama urgente. Su madre fue admitida ayer pero el cuidador dice que no aparece en el eMAR. Eres el Director. Que verificas primero en Zendity?

---SECCION_1---
LECTURA:
# El Director como Lider Operativo en Zendity

El Director es el rol de mayor responsabilidad ejecutiva dentro de una Sede en Zendity. A diferencia del cuidador o la enfermera que operan en el dia a dia clinico, el Director tiene una vista panoramica de toda la operacion: clinica, administrativa, financiera y regulatoria.

**Funciones ejecutivas del Director:**

- **Activacion clinica**: Asegurar que cada residente admitido pase de estado DORMANT a clinicamente activo con todos sus modulos habilitados.
- **Supervision de compliance**: Monitorear que todos los empleados cumplan con protocolos, capacitaciones y regulaciones.
- **Gestion de admisiones**: Supervisar el pipeline del CRM y aprobar admisiones nuevas.
- **Comunicacion institucional**: Ser el enlace entre la facilidad, las familias y las autoridades regulatorias.

El Director no necesita ejecutar cada tarea personalmente, pero si es responsable de que todo funcione. Zendity le proporciona herramientas de monitoreo y alertas para que pueda supervisar sin estar fisicamente presente en cada proceso. El digest ejecutivo resume diariamente los indicadores clave de la Sede.

PREGUNTAS:
P: Cual es la diferencia principal entre el rol del Director y el de la enfermera en Zendity?
a) El Director administra medicamentos y la enfermera supervisa empleados
*b) El Director tiene vista panoramica ejecutiva; la enfermera opera en el dia a dia clinico
c) No hay diferencia, ambos tienen el mismo nivel de acceso
d) La enfermera tiene mas autoridad que el Director
EXPLICACION: El Director tiene responsabilidad ejecutiva sobre toda la operacion, mientras la enfermera se enfoca en decisiones clinicas del dia a dia.

P: Que significa "activacion clinica" en el contexto del Director?
a) Dar de alta a un residente del sistema
*b) Asegurar que un residente admitido pase de DORMANT a clinicamente activo con todos sus modulos habilitados
c) Iniciar sesion en el sistema cada manana
d) Aprobar los horarios de los cuidadores
EXPLICACION: La activacion clinica es el proceso de asegurar que un residente recien admitido tenga todos sus modulos (eMAR, escalas, notas) habilitados y funcionales.

P: Para que sirve el digest ejecutivo en Zendity?
a) Para enviar mensajes a los familiares
b) Para registrar medicamentos administrados
*c) Para resumir diariamente los indicadores clave de la Sede
d) Para generar facturas automaticas
EXPLICACION: El digest ejecutivo es un resumen diario que el Director recibe con los indicadores clave de la Sede: compliance, alertas, admisiones y eventos relevantes.

P: Que responsabilidad tiene el Director respecto al compliance?
a) Ninguna, eso lo maneja HIPAA automaticamente
b) Solo revisar compliance una vez al ano
*c) Monitorear que todos los empleados cumplan con protocolos, capacitaciones y regulaciones
d) Delegar completamente al equipo de enfermeria
EXPLICACION: El Director es responsable de monitorear continuamente que todo el personal cumpla con protocolos internos, capacitaciones requeridas y regulaciones de HIPAA.

P: El Director necesita ejecutar personalmente cada tarea operativa?
a) Si, debe hacer todo personalmente
b) Si, pero solo durante el turno diurno
*c) No, pero es responsable de que todo funcione y lo supervisa con herramientas del sistema
d) No, porque el sistema lo hace todo automaticamente
EXPLICACION: El Director no ejecuta cada tarea pero si es responsable de la operacion completa. Zendity le da herramientas de monitoreo y alertas para supervisar remotamente.

---SECCION_2---
LECTURA:
# Activacion Clinica y Estados del Residente

Cuando un residente es admitido a traves del CRM, su expediente se crea automaticamente pero inicia en estado DORMANT. Esto significa que el expediente existe pero los modulos clinicos (eMAR, escalas, notas) aun no estan activos. Es responsabilidad del Director asegurar la activacion clinica completa.

**Estados del residente en Zendity:**

- **DORMANT**: Expediente creado pero sin modulos clinicos activos. El residente "existe" en el sistema pero no puede recibir servicios digitales.
- **ACTIVE**: Todos los modulos clinicos habilitados. El residente aparece en el dashboard del piso de cuido y en el eMAR.
- **DISCHARGED**: Residente dado de alta. Su expediente se conserva pero los modulos activos se desactivan.

**Checklist de activacion clinica:**

1. Verificar que el IntakeData esta completado por enfermeria
2. Confirmar la asignacion de grupo de color
3. Verificar que los medicamentos estan cargados en el eMAR
4. Confirmar que el PAI (Plan de Atencion Individualizado) tiene al menos el borrador inicial
5. Asegurar que el portal familiar esta habilitado

Si un residente permanece en DORMANT mas de 48 horas, Zendity genera una alerta al Director. Un residente DORMANT no aparece en el eMAR ni en las rondas del cuidador, lo que significa que podria no recibir atencion digital.

PREGUNTAS:
P: Que significa que un residente este en estado DORMANT?
a) Que el residente esta dormido y no necesita atencion
*b) Que el expediente existe pero los modulos clinicos no estan activos
c) Que el residente fue dado de alta
d) Que el residente tiene todos sus servicios habilitados
EXPLICACION: DORMANT indica que el expediente fue creado durante la admision pero los modulos clinicos (eMAR, escalas, notas) aun no se han activado.

P: Que riesgo existe si un residente permanece en DORMANT?
a) El sistema cobra tarifas adicionales
b) El familiar recibe notificaciones excesivas
*c) No aparece en el eMAR ni en rondas, por lo que podria no recibir atencion digital
d) Se elimina automaticamente del sistema
EXPLICACION: Un residente DORMANT no aparece en el eMAR ni en las rondas del cuidador, lo que significa que puede quedar sin cobertura digital de medicamentos y supervisiones.

P: Despues de cuantas horas genera Zendity una alerta si un residente sigue DORMANT?
a) 12 horas
b) 24 horas
*c) 48 horas
d) 72 horas
EXPLICACION: Zendity genera una alerta al Director si un residente permanece en estado DORMANT por mas de 48 horas desde su admision.

P: Cual es uno de los pasos del checklist de activacion clinica?
a) Configurar el acceso del residente a internet
b) Asignar un vehiculo de transporte
*c) Verificar que los medicamentos estan cargados en el eMAR
d) Crear una cuenta de correo electronico para el residente
EXPLICACION: Parte del checklist incluye verificar que los medicamentos del residente esten correctamente cargados en el eMAR para asegurar continuidad de tratamiento.

P: Que es el PAI en el contexto de la activacion clinica?
a) Un sistema de pago automatizado
b) Un protocolo de emergencia para incendios
*c) El Plan de Atencion Individualizado del residente
d) Un permiso administrativo de ingreso
EXPLICACION: El PAI (Plan de Atencion Individualizado) documenta las necesidades y objetivos de cuidado especificos del residente y debe tener al menos un borrador inicial durante la activacion.

---SECCION_3---
LECTURA:
# CRM y Pipeline de Admisiones

El Director es el responsable final del pipeline de admisiones en el CRM de Zendity. Mientras el equipo administrativo puede gestionar las etapas iniciales (PROSPECT, CONTACTED), las decisiones de avanzar un prospecto a EVALUATION y ADMISSION requieren supervision directiva.

**Vista del Director en el CRM:**

- **Metricas del pipeline**: Cuantos prospectos hay en cada etapa, tiempo promedio en cada fase, tasa de conversion.
- **Prospectos estancados**: Leads que llevan demasiado tiempo sin avanzar en el pipeline.
- **Capacidad de la facilidad**: Relacion entre camas disponibles y prospectos en proceso.

**Decisiones clave del Director:**

1. **Aprobar evaluaciones**: Cuando un prospecto pasa de CONTACTED a EVALUATION, el Director debe confirmar que hay capacidad y recursos para atender las necesidades del potencial residente.
2. **Autorizar admisiones**: Mover un lead a ADMISSION activa la creacion automatica de expediente. El Director debe verificar que toda la documentacion esta completa.
3. **Priorizar leads urgentes**: Algunos prospectos requieren admision rapida por condiciones clinicas o sociales. El Director puede acelerar el proceso.

El CRM del Director incluye filtros avanzados para visualizar prospectos por urgencia, tipo de cuidado requerido y fecha de primer contacto. Esto permite tomar decisiones informadas sobre el flujo de admisiones.

PREGUNTAS:
P: Que etapas del pipeline requieren supervision del Director?
a) Solo la etapa PROSPECT
b) Ninguna, todo es automatico
*c) Las transiciones a EVALUATION y ADMISSION requieren supervision directiva
d) Solo la etapa CONTACTED
EXPLICACION: Aunque el equipo administrativo gestiona etapas iniciales, avanzar a EVALUATION y ADMISSION requiere que el Director verifique capacidad, recursos y documentacion.

P: Que son los "prospectos estancados" en el CRM?
a) Prospectos que ya fueron admitidos
*b) Leads que llevan demasiado tiempo sin avanzar en el pipeline
c) Familiares que cancelaron la admision
d) Residentes dados de alta recientemente
EXPLICACION: Los prospectos estancados son leads que permanecen en una etapa del pipeline por demasiado tiempo, indicando que necesitan atencion o seguimiento.

P: Que debe verificar el Director antes de autorizar una admision?
a) Solo que hay camas disponibles
b) Que el prospecto tiene seguro medico
*c) Que toda la documentacion esta completa y hay capacidad para atender al residente
d) Que el familiar ha pagado el primer mes
EXPLICACION: Antes de mover un lead a ADMISSION, el Director verifica documentacion completa, capacidad de la facilidad y recursos disponibles para el cuidado adecuado.

P: Que sucede automaticamente cuando un lead se mueve a ADMISSION?
a) Se envia un email de bienvenida unicamente
*b) Se crea automaticamente el expediente del residente con todos los registros asociados
c) Se elimina del CRM permanentemente
d) Se asigna un cuidador sin intervencion humana
EXPLICACION: Al mover un lead a ADMISSION, Zendity ejecuta una transaccion automatica que crea el expediente, IntakeData, Plan de Vida en borrador y portal familiar.

P: Para que sirven los filtros avanzados del CRM del Director?
a) Para eliminar prospectos no deseados
b) Para enviar publicidad a los leads
*c) Para visualizar prospectos por urgencia, tipo de cuidado y fecha de contacto y tomar decisiones informadas
d) Para transferir prospectos a otras facilidades
EXPLICACION: Los filtros permiten al Director ver prospectos organizados por urgencia, tipo de cuidado requerido y fecha de contacto, facilitando la toma de decisiones sobre el flujo de admisiones.

---SECCION_4---
LECTURA:
# ComplianceScore y Digest Ejecutivo

El complianceScore es una metrica central en Zendity que mide el nivel de cumplimiento regulatorio y operativo de la facilidad. Para el Director, este indicador es vital porque refleja la salud operativa de la Sede y puede impactar inspecciones regulatorias.

**Componentes del complianceScore:**

- **Capacitacion del personal**: Porcentaje de empleados que han completado los cursos requeridos en Academy.
- **Documentacion clinica**: Porcentaje de expedientes con IntakeData completo, escalas actualizadas y notas al dia.
- **Administracion de medicamentos**: Tasa de medicamentos administrados a tiempo vs. omitidos o retrasados.
- **Evaluaciones periodicas**: Cumplimiento de reevaluaciones semanales de escalas Downton y Braden.

**El Digest Ejecutivo:**

Cada dia, Zendity genera un digest ejecutivo para el Director que incluye: complianceScore actualizado, alertas criticas sin resolver, residentes en estado DORMANT, medicamentos HELD activos, y un resumen de incidentes del dia anterior. Este digest se puede recibir por email o consultarlo directamente en el dashboard.

El Director debe revisar el digest cada manana como primera actividad. Si el complianceScore baja de un umbral critico, Zendity envia alertas adicionales. Mantener un complianceScore alto no es solo buena practica — es evidencia documentada ante reguladores de que la facilidad opera correctamente.

PREGUNTAS:
P: Que mide el complianceScore en Zendity?
a) La satisfaccion de los familiares con el servicio
b) El numero de residentes admitidos por mes
*c) El nivel de cumplimiento regulatorio y operativo de la facilidad
d) Las horas trabajadas por cada empleado
EXPLICACION: El complianceScore mide el cumplimiento de la facilidad en capacitacion, documentacion clinica, administracion de medicamentos y evaluaciones periodicas.

P: Cual de estos es un componente del complianceScore?
a) El numero de visitas familiares por semana
*b) El porcentaje de empleados que han completado cursos requeridos en Academy
c) Los ingresos financieros mensuales de la facilidad
d) La cantidad de comidas servidas diariamente
EXPLICACION: La capacitacion del personal es un componente clave del complianceScore, midiendo que porcentaje de empleados tienen sus cursos Academy al dia.

P: Que incluye el digest ejecutivo diario?
a) Solo el reporte financiero
b) Unicamente la lista de empleados del turno
*c) ComplianceScore, alertas criticas, residentes DORMANT, HELD activos y resumen de incidentes
d) Solo las admisiones nuevas del dia
EXPLICACION: El digest ejecutivo incluye complianceScore actualizado, alertas sin resolver, residentes DORMANT, medicamentos HELD y resumen de incidentes recientes.

P: Cuando debe el Director revisar el digest ejecutivo?
a) Una vez a la semana los lunes
b) Solo cuando recibe una alerta critica
*c) Cada manana como primera actividad
d) Al final de cada mes
EXPLICACION: El Director debe revisar el digest ejecutivo cada manana como primera actividad para mantenerse informado del estado operativo de la Sede.

P: Por que es importante mantener un complianceScore alto?
a) Solo por apariencia ante los familiares
b) Para obtener descuentos en el sistema Zendity
*c) Porque es evidencia documentada ante reguladores de que la facilidad opera correctamente
d) Porque determina el salario de los empleados
EXPLICACION: Un complianceScore alto es evidencia documentada de operacion correcta, esencial para inspecciones regulatorias y para demostrar cumplimiento ante autoridades.

---SECCION_5---
LECTURA:
# Supervision Remota y HIPAA

Una de las ventajas clave de Zendity para el Director es la capacidad de supervisar la operacion remotamente. Sin embargo, esta capacidad viene con responsabilidades adicionales de seguridad y cumplimiento HIPAA.

**Herramientas de supervision remota:**

- **Dashboard en tiempo real**: Vista de residentes activos, alertas y metricas desde cualquier dispositivo con conexion.
- **Notificaciones push**: Alertas criticas enviadas directamente al dispositivo del Director (caidas, emergencias, compliance bajo).
- **Digest por email**: Resumen diario que se puede revisar desde el correo sin necesidad de acceder al sistema completo.
- **Reportes programados**: Informes semanales y mensuales generados automaticamente con tendencias y comparativos.

**HIPAA y la supervision remota:**

Al acceder a Zendity desde fuera de la facilidad, el Director debe mantener los mismos estandares de seguridad. Esto significa no acceder desde redes WiFi publicas sin proteccion, no compartir pantalla con personas no autorizadas, no dejar sesiones abiertas en dispositivos personales, y no descargar reportes con datos clinicos a dispositivos no seguros.

El Director es tambien responsable de que todo el personal cumpla con HIPAA. Si detecta una violacion — un cuidador compartiendo fotos de un residente, una enfermera dejando sesion abierta — debe documentar el incidente y tomar accion correctiva inmediata. Zendity registra automaticamente los accesos, facilitando la investigacion de incidentes.

PREGUNTAS:
P: Cual es una herramienta de supervision remota del Director en Zendity?
a) Camaras de seguridad integradas en el sistema
*b) Dashboard en tiempo real accesible desde cualquier dispositivo con conexion
c) Llamadas automaticas a los cuidadores cada hora
d) Un robot de asistencia fisica en la facilidad
EXPLICACION: El dashboard en tiempo real permite al Director ver residentes activos, alertas y metricas desde cualquier dispositivo conectado, facilitando la supervision remota.

P: Que precaucion de HIPAA debe tomar el Director al acceder remotamente a Zendity?
a) Usar siempre el telefono personal sin contrasena
*b) No acceder desde redes WiFi publicas sin proteccion
c) Compartir pantalla con familiares para mayor transparencia
d) Descargar todos los reportes a su computadora personal
EXPLICACION: HIPAA requiere que el acceso remoto se haga desde redes seguras, sin compartir pantalla con personas no autorizadas y sin descargar datos clinicos a dispositivos no seguros.

P: Que debe hacer el Director si detecta una violacion de HIPAA por parte de un empleado?
a) Ignorarlo si es un empleado de confianza
b) Esperar a la proxima evaluacion anual para mencionarlo
*c) Documentar el incidente y tomar accion correctiva inmediata
d) Transferir al empleado a otra facilidad
EXPLICACION: Las violaciones de HIPAA requieren documentacion inmediata del incidente y accion correctiva. El Director es responsable de que todo el personal cumpla con las regulaciones.

P: Que facilita Zendity para la investigacion de incidentes de seguridad?
a) Un chatbot que entrevista a los empleados
b) Grabaciones de audio de las conversaciones
*c) Registro automatico de todos los accesos al sistema
d) Encuestas anonimas enviadas al personal
EXPLICACION: Zendity registra automaticamente todos los accesos al sistema (quien, cuando, que modulo), facilitando la investigacion de incidentes de seguridad y violaciones de HIPAA.

P: Que tipo de alertas recibe el Director como notificaciones push?
a) Recordatorios de cumpleanos de residentes
b) Ofertas promocionales del sistema
*c) Alertas criticas como caidas, emergencias y compliance bajo
d) Mensajes de otros directores de la red
EXPLICACION: Las notificaciones push al Director incluyen alertas criticas como caidas de residentes, emergencias clinicas y alertas de compliance bajo que requieren atencion inmediata.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 12: EL ADMINISTRADOR EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ADMIN_101',
    title: 'El Administrador en Zendity',
    description: 'Funciones administrativas en Zendity: pipeline de admisiones, calendario corporativo, comunicaciones y seguimiento operativo.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '📊',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: El Administrador en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende las funciones y limites del rol Admin en Zendity, incluyendo que puede hacer de forma autonoma y que requiere autorizacion del Director.
TERMINOS_CLAVE: pipeline de admisiones, Intake Maestro, calendario corporativo, ZendiAssist CORPORATE_COMMS_POLISH, seguimiento operativo, Directorio Staff, ausencia del Director, comunicaciones institucionales
PREGUNTA_REFLEXION: El Director esta fuera. Una familia llama para admitir a su familiar urgente. Que puedes hacer tu como Admin y que requiere esperar al Director?

---SECCION_1---
LECTURA:
# El Rol Admin en la Estructura de Zendity

El Administrador (Admin) es el brazo operativo del Director dentro de Zendity. Mientras el Director toma decisiones estrategicas y clinicas, el Admin se encarga de la ejecucion diaria de procesos administrativos que mantienen la facilidad funcionando.

**Posicion en la jerarquia:**

El Admin tiene acceso amplio a los modulos corporativos de Zendity pero con limites claros. Puede gestionar el pipeline de admisiones en etapas iniciales, mantener el calendario corporativo, coordinar comunicaciones institucionales y dar seguimiento operativo a tareas pendientes.

**Lo que el Admin NO puede hacer:**

- Autorizar la transicion final de un lead a ADMISSION (requiere Director)
- Modificar configuraciones clinicas o protocolos medicos
- Aprobar o rechazar evaluaciones clinicas de prospectos
- Cambiar roles o permisos de otros usuarios en el sistema

**Valor del Admin en la operacion:**

El Admin es quien asegura que los procesos administrativos no se detengan. Cuando el Director esta en reuniones, supervisando el piso o fuera de la facilidad, el Admin mantiene el flujo de trabajo avanzando dentro de sus limites de autoridad. Es el primer punto de contacto para consultas operativas y logisticas.

PREGUNTAS:
P: Cual es la relacion entre el Admin y el Director en Zendity?
a) Son roles identicos con el mismo acceso
*b) El Admin es el brazo operativo del Director, ejecutando procesos administrativos diarios
c) El Admin supervisa al Director
d) El Director reporta al Admin
EXPLICACION: El Admin ejecuta los procesos administrativos diarios mientras el Director toma decisiones estrategicas y clinicas. El Admin opera dentro de limites definidos.

P: Cual de estas acciones puede realizar el Admin de forma autonoma?
a) Autorizar la admision final de un residente
b) Cambiar roles de otros usuarios en el sistema
*c) Gestionar el pipeline de admisiones en etapas iniciales
d) Modificar protocolos clinicos
EXPLICACION: El Admin puede gestionar prospectos en etapas iniciales del pipeline (PROSPECT, CONTACTED), pero la transicion a ADMISSION requiere autorizacion del Director.

P: Que NO puede hacer el Admin en Zendity?
a) Mantener el calendario corporativo
b) Coordinar comunicaciones institucionales
*c) Autorizar la transicion final de un lead a ADMISSION
d) Dar seguimiento operativo a tareas pendientes
EXPLICACION: La transicion de un lead a ADMISSION (que activa la creacion del expediente) requiere autorizacion del Director por su impacto clinico y operativo.

P: Cuando es particularmente critico el rol del Admin?
a) Solo durante las mananas del turno diurno
*b) Cuando el Director esta en reuniones, supervisando el piso o fuera de la facilidad
c) Unicamente durante las admisiones nuevas
d) Solo cuando hay inspecciones regulatorias
EXPLICACION: El Admin mantiene el flujo de trabajo cuando el Director no esta disponible, asegurando que los procesos administrativos no se detengan.

P: Que tipo de modulos puede acceder el Admin en Zendity?
a) Solo los modulos clinicos del piso de cuido
b) Todos los modulos sin ninguna restriccion
*c) Los modulos corporativos con limites claros definidos por su rol
d) Solo el modulo de Academy
EXPLICACION: El Admin tiene acceso a modulos corporativos (CRM, calendario, comunicaciones) pero con limites definidos que excluyen funciones clinicas y decisiones de admision final.

---SECCION_2---
LECTURA:
# Pipeline de Admisiones e Intake Maestro

El Admin juega un rol crucial en las primeras etapas del pipeline de admisiones. Usando la herramienta Intake Maestro de Zendity, puede gestionar prospectos de manera eficiente y profesional.

**Funciones del Admin en el pipeline:**

- **Crear leads nuevos**: Cuando una familia contacta la facilidad, el Admin registra los datos basicos en el CRM (nombre, telefono, email, notas iniciales).
- **Gestionar etapa PROSPECT**: Organizar los prospectos nuevos, asignar prioridad y documentar detalles del primer contacto.
- **Avanzar a CONTACTED**: Despues de la primera conversacion con la familia, el Admin actualiza el status y documenta necesidades, expectativas y preguntas de la familia.
- **Preparar para EVALUATION**: Recopilar documentacion preliminar y coordinar la agenda de evaluacion con el equipo clinico.

**Intake Maestro:**

Intake Maestro es un asistente de Zendity que guia al Admin paso a paso durante el proceso de registro de un nuevo prospecto. Sugiere campos importantes, valida informacion y alerta si faltan datos criticos. Esto reduce errores y asegura que cada lead tenga la informacion minima necesaria para avanzar en el pipeline.

El Admin debe mantener el pipeline limpio: hacer seguimiento a prospectos estancados, actualizar notas despues de cada contacto y asegurar que ningun lead quede sin atencion por mas de 48 horas.

PREGUNTAS:
P: Que es Intake Maestro en Zendity?
a) Un curso de capacitacion para nuevos empleados
b) Un modulo para administrar medicamentos
*c) Un asistente que guia al Admin paso a paso durante el registro de nuevos prospectos
d) Un reporte financiero automatizado
EXPLICACION: Intake Maestro es un asistente de Zendity que guia el proceso de registro de prospectos, sugiriendo campos, validando datos y alertando sobre informacion faltante.

P: Hasta que etapa del pipeline puede el Admin avanzar un lead de forma autonoma?
a) Hasta ADMISSION
*b) Hasta CONTACTED, y preparar para EVALUATION
c) Solo puede crear el lead sin avanzarlo
d) Puede avanzar a cualquier etapa sin restriccion
EXPLICACION: El Admin puede crear leads, gestionar PROSPECT, avanzar a CONTACTED y preparar la documentacion para EVALUATION, pero las decisiones de evaluacion y admision requieren al Director.

P: Cada cuanto debe el Admin hacer seguimiento a prospectos sin actividad?
a) Una vez al mes
b) Solo cuando el Director lo solicite
*c) Ningun lead debe quedar sin atencion por mas de 48 horas
d) Cada 2 semanas
EXPLICACION: El Admin debe mantener el pipeline activo asegurando que ningun lead quede sin atencion por mas de 48 horas, haciendo seguimiento y actualizando notas regularmente.

P: Que debe hacer el Admin despues de cada contacto con una familia prospecto?
a) Esperar a que la familia llame de nuevo
*b) Actualizar las notas del lead en el CRM con la informacion de la conversacion
c) Eliminar el lead si no confirmo inmediatamente
d) Transferir el lead al Director sin documentar
EXPLICACION: Despues de cada contacto, el Admin actualiza notas en el CRM documentando necesidades, expectativas y preguntas de la familia para mantener el registro completo.

P: Que beneficio aporta Intake Maestro al proceso de admision?
a) Elimina la necesidad del rol de Director
b) Automatiza completamente la admision sin intervencion humana
*c) Reduce errores y asegura que cada lead tenga la informacion minima necesaria
d) Permite que los familiares se auto-registren
EXPLICACION: Intake Maestro reduce errores de registro al validar datos, sugerir campos importantes y alertar sobre informacion faltante antes de que el lead avance.

---SECCION_3---
LECTURA:
# Calendario Corporativo y Seguimiento Operativo

El Admin es responsable de mantener el calendario corporativo de la Sede y dar seguimiento a las tareas operativas pendientes. Este rol es esencial para la coordinacion diaria de la facilidad.

**Calendario corporativo:**

El calendario en Zendity centraliza todos los eventos relevantes de la Sede: reuniones de equipo, visitas de familiares programadas, inspecciones regulatorias, fechas de vencimiento de certificaciones, cumpleanos de residentes y eventos especiales.

**Funciones del Admin en el calendario:**

- Programar y modificar eventos de la Sede
- Enviar recordatorios al personal sobre reuniones y fechas importantes
- Coordinar agendas entre departamentos (clinico, administrativo, mantenimiento)
- Registrar y dar seguimiento a citas externas de residentes

**Seguimiento operativo:**

El Admin usa el dashboard corporativo para monitorear tareas pendientes: documentos por completar, renovaciones de certificaciones proximas, seguimientos de prospectos y tareas asignadas por el Director. Cada tarea tiene un responsable y una fecha limite visibles en el sistema.

La clave del seguimiento operativo es la consistencia. El Admin debe revisar las tareas pendientes diariamente, actualizar el estado de cada una y escalar al Director cuando algo requiere atencion inmediata o esta fuera de su autoridad.

PREGUNTAS:
P: Que centraliza el calendario corporativo en Zendity?
a) Solo los horarios de medicamentos de los residentes
b) Las redes sociales de la facilidad
*c) Todos los eventos relevantes de la Sede: reuniones, visitas, inspecciones y fechas clave
d) Solo los cumpleanos de los empleados
EXPLICACION: El calendario corporativo centraliza reuniones, visitas familiares, inspecciones, vencimientos de certificaciones, cumpleanos de residentes y eventos especiales de la Sede.

P: Que rol tiene el Admin en la coordinacion entre departamentos?
a) Ninguno, cada departamento se coordina solo
*b) Coordinar agendas entre departamentos clinico, administrativo y mantenimiento
c) Solo coordinar con el departamento de cocina
d) Supervisar las decisiones clinicas de enfermeria
EXPLICACION: El Admin coordina agendas entre todos los departamentos de la facilidad, asegurando que reuniones, tareas y eventos no se superpongan y fluyan correctamente.

P: Con que frecuencia debe el Admin revisar las tareas pendientes?
a) Semanalmente cada lunes
b) Solo cuando el Director lo solicita
*c) Diariamente
d) Al final de cada mes
EXPLICACION: La revision diaria de tareas pendientes es clave para el seguimiento operativo efectivo, permitiendo al Admin mantener todo al dia y escalar lo necesario.

P: Que debe hacer el Admin cuando una tarea pendiente esta fuera de su autoridad?
a) Completarla de todas formas para no retrasar el proceso
b) Eliminar la tarea del sistema
*c) Escalar al Director para que tome la decision correspondiente
d) Asignarla a otro empleado sin consultar
EXPLICACION: Cuando una tarea requiere autoridad superior, el Admin debe escalar al Director. Actuar fuera de sus limites podria comprometer procesos criticos.

P: Que informacion tiene cada tarea en el sistema de seguimiento operativo?
a) Solo el nombre de la tarea
b) El nombre y un codigo de colores
*c) Un responsable asignado y una fecha limite visibles en el sistema
d) Solo la fecha de creacion
EXPLICACION: Cada tarea operativa en Zendity tiene un responsable asignado y una fecha limite, permitiendo transparencia y rendicion de cuentas en el seguimiento.

---SECCION_4---
LECTURA:
# ZendiAssist para Comunicaciones

ZendiAssist es el asistente de inteligencia artificial de Zendity. Para el Admin, la funcion CORPORATE_COMMS_POLISH es particularmente valiosa: ayuda a redactar y pulir comunicaciones institucionales profesionales.

**Que es CORPORATE_COMMS_POLISH?**

Es una funcion de ZendiAssist que toma un borrador de comunicacion escrito por el Admin y lo transforma en un mensaje profesional, manteniendo el tono institucional apropiado. Funciona para emails a familias, comunicados internos, notificaciones de eventos y respuestas a consultas formales.

**Como usar CORPORATE_COMMS_POLISH:**

1. El Admin redacta un borrador con la informacion esencial del mensaje
2. Activa ZendiAssist y selecciona la funcion CORPORATE_COMMS_POLISH
3. El asistente genera una version pulida manteniendo el contenido original
4. El Admin revisa, ajusta si es necesario y envia

**Directorio Staff:**

El Admin tambien gestiona el Directorio Staff de la Sede, que contiene la informacion de contacto y rol de cada empleado. Este directorio es esencial para coordinar comunicaciones internas y saber a quien contactar en cada departamento. Mantener el directorio actualizado es responsabilidad directa del Admin.

Las comunicaciones institucionales representan la imagen de la facilidad. Un email mal redactado a una familia puede generar desconfianza. CORPORATE_COMMS_POLISH asegura que cada mensaje refleje profesionalismo.

PREGUNTAS:
P: Que hace la funcion CORPORATE_COMMS_POLISH de ZendiAssist?
a) Traduce mensajes a otros idiomas automaticamente
*b) Toma un borrador del Admin y lo transforma en una comunicacion profesional institucional
c) Envia emails automaticamente sin revision
d) Crea presentaciones visuales para reuniones
EXPLICACION: CORPORATE_COMMS_POLISH pulE borradores de comunicacion del Admin para producir mensajes profesionales con el tono institucional apropiado.

P: Despues de que ZendiAssist genera la version pulida, que debe hacer el Admin?
a) Enviar inmediatamente sin leer
b) Eliminarlo y escribir uno nuevo
*c) Revisar el mensaje, ajustar si es necesario y luego enviar
d) Pedir al Director que lo reescriba completamente
EXPLICACION: El Admin debe siempre revisar y ajustar la version generada antes de enviar, asegurandose de que el contenido sea preciso y apropiado.

P: Que es el Directorio Staff en Zendity?
a) Una lista de residentes y sus familiares
b) Un directorio de proveedores externos
*c) La informacion de contacto y rol de cada empleado de la Sede
d) Una base de datos de medicamentos disponibles
EXPLICACION: El Directorio Staff contiene la informacion de contacto y rol de cada empleado, esencial para coordinar comunicaciones internas y saber quien cubre cada funcion.

P: Por que son importantes las comunicaciones profesionales en una facilidad de cuido?
a) Solo por cumplir con requisitos legales
b) Porque los familiares no leen mensajes informales
*c) Porque representan la imagen de la facilidad y un mensaje mal redactado puede generar desconfianza
d) Porque Zendity cobra extra por mensajes informales
EXPLICACION: Las comunicaciones institucionales representan la imagen de la facilidad ante familias, reguladores y la comunidad. El profesionalismo genera confianza.

P: Quien es responsable de mantener actualizado el Directorio Staff?
a) Cada empleado actualiza sus propios datos
b) El equipo de enfermeria
*c) El Admin de la Sede
d) El sistema lo actualiza automaticamente
EXPLICACION: Mantener el Directorio Staff actualizado es responsabilidad directa del Admin, asegurando que la informacion de contacto y roles este siempre al dia.

---SECCION_5---
LECTURA:
# Limites del Admin y Protocolo de Ausencia del Director

Entender los limites del rol Admin es tan importante como conocer sus funciones. En situaciones donde el Director no esta disponible, el Admin debe saber exactamente que puede hacer y que debe esperar.

**Acciones autonomas del Admin (sin Director):**

- Crear y gestionar leads en etapas PROSPECT y CONTACTED
- Mantener el calendario corporativo y programar eventos
- Redactar y enviar comunicaciones usando ZendiAssist
- Actualizar el Directorio Staff
- Dar seguimiento a tareas operativas pendientes
- Recibir llamadas y documentar consultas de familias

**Acciones que REQUIEREN al Director:**

- Aprobar transicion de leads a EVALUATION o ADMISSION
- Tomar decisiones sobre capacidad y recursos clinicos
- Modificar roles o permisos de usuarios
- Autorizar gastos o compromisos financieros
- Responder a inspecciones regulatorias

**Protocolo de ausencia del Director:**

1. El Admin documenta todas las solicitudes y consultas recibidas durante la ausencia
2. Clasifica cada solicitud como urgente o no urgente
3. Para solicitudes urgentes: contacta al Director por telefono o mensaje
4. Para solicitudes no urgentes: las registra en el sistema para revision del Director al regresar
5. Nunca excede su autoridad, aunque la situacion parezca simple

La transparencia es clave. El Admin debe registrar en Zendity cada accion tomada y cada solicitud pendiente durante la ausencia del Director para mantener trazabilidad completa.

PREGUNTAS:
P: Que debe hacer el Admin cuando una familia llama para admitir urgente y el Director no esta?
a) Aprobar la admision para no perder al prospecto
b) Rechazar la solicitud hasta que regrese el Director
*c) Documentar la solicitud, clasificarla como urgente y contactar al Director
d) Transferir la llamada a enfermeria
EXPLICACION: El Admin no puede aprobar admisiones. Debe documentar la solicitud urgente y contactar al Director para que tome la decision, manteniendo a la familia informada.

P: Cual de estas acciones puede hacer el Admin de forma autonoma durante la ausencia del Director?
a) Aprobar la evaluacion de un prospecto
*b) Crear leads nuevos y enviar comunicaciones institucionales
c) Cambiar los permisos de acceso de otros empleados
d) Autorizar gastos de mantenimiento de la facilidad
EXPLICACION: El Admin puede crear leads, gestionar comunicaciones, mantener el calendario y dar seguimiento operativo sin necesidad de aprobacion del Director.

P: Como debe clasificar el Admin las solicitudes recibidas durante la ausencia del Director?
a) Por departamento unicamente
b) Por orden de llegada sin priorizar
*c) Como urgentes o no urgentes
d) Solo documentar las de familiares y descartar las demas
EXPLICACION: El Admin clasifica cada solicitud como urgente o no urgente. Las urgentes se escalan al Director inmediatamente; las no urgentes se registran para revision posterior.

P: Por que es importante que el Admin nunca exceda su autoridad?
a) Porque el sistema bloquea automaticamente acciones no autorizadas
*b) Porque actuar fuera de sus limites podria comprometer decisiones clinicas u operativas criticas
c) Porque recibiria una multa automatica del sistema
d) Porque el Director se molestaria personalmente
EXPLICACION: Exceder la autoridad del Admin podria comprometer decisiones que requieren juicio clinico o directivo, poniendo en riesgo la operacion y el cuidado de los residentes.

P: Que debe registrar el Admin en Zendity durante la ausencia del Director?
a) Solo las llamadas de familiares
b) Nada, debe esperar al Director para documentar
*c) Cada accion tomada y cada solicitud pendiente para mantener trazabilidad completa
d) Solo las emergencias clinicas
EXPLICACION: La trazabilidad completa es clave. El Admin registra cada accion y solicitud en Zendity para que el Director tenga visibilidad total al regresar.
`
}
,

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 13: TURNO NOCTURNO DEL CUIDADOR
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'TURNO_NOCTURNO_101',
    title: 'Turno Nocturno del Cuidador',
    description: 'Protocolo especial del turno nocturno: handover virtual, rondas, incidentes y toma de decisiones sin supervision presencial.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🌙',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: Turno Nocturno del Cuidador
PROMPT_ZENDI: Evalua si el empleado comprende los protocolos especificos del turno nocturno, incluyendo la toma de decisiones autonoma, el escalado remoto y la documentacion de incidentes.
TERMINOS_CLAVE: handover virtual, Prologo del Turno, rondas nocturnas, toma de decisiones solo, incidente nocturno, escalado remoto, cierre 6am, sesion zombi, MISSED nocturno, Override Forzado
PREGUNTA_REFLEXION: Son las 3am. Un residente se cayo. No hay supervisor ni enfermera en la sede. Describe exactamente que haces y como lo documentas en Zendity.

---SECCION_1---
LECTURA:
# Particularidades del Turno Nocturno

El turno nocturno en un hogar de cuido es radicalmente diferente al turno diurno. El cuidador nocturno opera con supervision minima o nula, lo que significa que la toma de decisiones recae directamente sobre el. No hay enfermera de piso, no hay director presente y la comunicacion con supervisores es remota. Zendity reconoce esta realidad y ha disenado protocolos especificos para el turno de noche. El sistema provee herramientas que compensan la ausencia fisica de liderazgo: alertas automaticas, escalado remoto y documentacion en tiempo real. Una sesion zombi ocurre cuando un cuidador no interactua con Zendity durante mas de 90 minutos consecutivos en horario nocturno, lo que dispara una alerta al supervisor remoto. El objetivo no es vigilar al cuidador, sino protegerlo. Si ocurre un incidente a las 3am sin testigos, la documentacion en Zendity es la unica evidencia objetiva de lo que paso. El turno nocturno exige disciplina, autonomia y dominio del sistema.

PREGUNTAS:
P: Que es una sesion zombi en el contexto del turno nocturno?
a) Un turno donde el cuidador se queda dormido
*b) Cuando el cuidador no interactua con Zendity por mas de 90 minutos consecutivos
c) Un error del sistema que bloquea la sesion del cuidador
d) Una sesion que se abre automaticamente a medianoche
EXPLICACION: La sesion zombi se activa cuando Zendity detecta que no ha habido interaccion del cuidador por mas de 90 minutos en horario nocturno, disparando una alerta al supervisor remoto.

P: Por que la documentacion en Zendity es especialmente critica durante el turno nocturno?
a) Porque el sistema necesita datos para generar reportes diarios
*b) Porque es la unica evidencia objetiva si ocurre un incidente sin testigos
c) Porque el director lo revisa a primera hora de la manana
d) Porque los familiares tienen acceso en tiempo real
EXPLICACION: Sin testigos presentes, la documentacion en Zendity se convierte en la unica evidencia objetiva de lo ocurrido durante un incidente nocturno.

P: Cual es la principal diferencia operativa entre el turno diurno y el nocturno?
a) El turno nocturno tiene menos residentes asignados
b) El turno nocturno usa un modulo diferente de Zendity
*c) El cuidador nocturno opera con supervision minima o nula y toma decisiones solo
d) El turno nocturno no requiere documentacion
EXPLICACION: La diferencia clave es que el cuidador nocturno trabaja sin supervision presencial directa, asumiendo mayor responsabilidad en la toma de decisiones.

P: Que ocurre cuando Zendity detecta una sesion zombi?
a) El sistema cierra la sesion automaticamente
b) Se descuenta tiempo del turno del cuidador
*c) Se dispara una alerta al supervisor remoto
d) El cuidador recibe una amonestacion automatica
EXPLICACION: La sesion zombi dispara una alerta al supervisor remoto para verificar que el cuidador esta bien y operativo, no para penalizarlo.

P: Cual es el objetivo principal de los protocolos nocturnos de Zendity?
a) Vigilar al cuidador para evitar que duerma
b) Generar mas datos para reportes de compliance
*c) Proteger al cuidador compensando la ausencia de supervision presencial
d) Reducir el numero de incidentes nocturnos a cero
EXPLICACION: Los protocolos nocturnos de Zendity estan disenados para proteger al cuidador, proveyendo herramientas que compensan la falta de supervision fisica.

---SECCION_2---
LECTURA:
# Handover Virtual y Prologo del Turno

El turno nocturno comienza con el handover virtual, un proceso estructurado donde el cuidador saliente transfiere informacion critica al cuidador entrante a traves de Zendity. Este proceso no es opcional. El cuidador entrante debe revisar el Prologo del Turno, una pantalla que resume los eventos clave del turno anterior: incidentes abiertos, medicamentos pendientes, residentes con alertas activas y notas del supervisor. Zendity no permite iniciar el turno nocturno sin que el cuidador confirme que leyo el Prologo. Si el cuidador saliente no completo su cierre, Zendity marca esos items como MISSED y los transfiere automaticamente al turno entrante con prioridad alta. El handover virtual elimina la dependencia de comunicacion verbal, que es propensa a errores y olvidos. Todo queda registrado. Si el cuidador entrante tiene preguntas sobre algun item del Prologo, puede enviar un mensaje directo al cuidador saliente a traves del sistema. El handover virtual es el primer acto de responsabilidad del turno nocturno.

PREGUNTAS:
P: Que es el Prologo del Turno en Zendity?
a) Un video de capacitacion que se reproduce al inicio del turno
*b) Una pantalla que resume los eventos clave del turno anterior
c) Un formulario que el supervisor llena antes del turno
d) Una lista de tareas generadas automaticamente por Zendity
EXPLICACION: El Prologo del Turno es una pantalla resumen que incluye incidentes abiertos, medicamentos pendientes, residentes con alertas y notas del supervisor del turno anterior.

P: Que sucede si el cuidador saliente no completo el cierre de su turno?
a) El turno entrante comienza sin esa informacion
b) El supervisor debe completar el cierre manualmente
*c) Zendity marca los items como MISSED y los transfiere con prioridad alta al turno entrante
d) El sistema bloquea al cuidador saliente hasta que complete el cierre
EXPLICACION: Los items incompletos se marcan como MISSED y se transfieren automaticamente al turno entrante con prioridad alta para garantizar continuidad.

P: Por que Zendity no permite iniciar el turno nocturno sin confirmar la lectura del Prologo?
a) Porque es un requisito de la auditoria estatal
b) Porque el director necesita confirmar la asistencia del cuidador
*c) Para asegurar que el cuidador entrante conoce los eventos criticos del turno anterior
d) Porque el sistema necesita tiempo para cargar los datos del turno
EXPLICACION: Confirmar la lectura del Prologo garantiza que el cuidador nocturno esta informado de situaciones criticas antes de asumir el turno.

P: Cual es la ventaja principal del handover virtual sobre la comunicacion verbal?
a) Es mas rapido que hablar con el cuidador saliente
b) Permite al supervisor escuchar la conversacion
*c) Elimina errores y olvidos al quedar todo registrado en el sistema
d) No requiere que ambos cuidadores esten presentes al mismo tiempo
EXPLICACION: El handover virtual elimina la dependencia de comunicacion verbal, que es propensa a errores y olvidos, dejando todo documentado en Zendity.

P: Si el cuidador entrante tiene dudas sobre un item del Prologo, que debe hacer?
a) Llamar al supervisor remoto inmediatamente
b) Ignorar la duda y verificar presencialmente al residente
*c) Enviar un mensaje directo al cuidador saliente a traves de Zendity
d) Esperar al turno diurno para preguntar
EXPLICACION: Zendity permite enviar un mensaje directo al cuidador saliente para aclarar dudas sobre items especificos del Prologo del Turno.

---SECCION_3---
LECTURA:
# Rondas Nocturnas y Documentacion

Las rondas nocturnas son el corazon del turno de noche. Zendity establece intervalos obligatorios de ronda cada 2 horas, comenzando desde la hora de inicio del turno. Cada ronda requiere que el cuidador visite fisicamente a cada residente asignado y registre su estado en la app: dormido, despierto, inquieto, ausente de cama o requiere atencion. El registro incluye hora exacta y, si hay novedad, una nota obligatoria. Si un cuidador no completa una ronda dentro de la ventana de tiempo asignada, Zendity genera un MISSED nocturno que aparece en el dashboard del supervisor. No existe Override Forzado para las rondas: no se pueden marcar retroactivamente. El cuidador debe documentar la razon del retraso en una nota aparte. Las rondas nocturnas tambien incluyen verificacion ambiental: temperatura de la habitacion, funcionamiento del aire acondicionado o ventilador, y estado de las barandas de cama. Zendity archiva el historial de rondas por residente, creando un registro longitudinal que es invaluable para auditorias y para detectar patrones de comportamiento nocturno de los residentes.

PREGUNTAS:
P: Con que frecuencia deben realizarse las rondas nocturnas segun el protocolo de Zendity?
a) Cada hora
*b) Cada 2 horas
c) Cada 3 horas
d) Solo cuando hay una alerta activa
EXPLICACION: Zendity establece intervalos obligatorios de ronda cada 2 horas durante el turno nocturno, comenzando desde la hora de inicio del turno.

P: Que estados puede registrar el cuidador para un residente durante una ronda nocturna?
a) Solo dormido o despierto
b) Estable, inestable o critico
*c) Dormido, despierto, inquieto, ausente de cama o requiere atencion
d) Normal o anormal
EXPLICACION: Zendity ofrece cinco opciones de estado durante las rondas nocturnas: dormido, despierto, inquieto, ausente de cama o requiere atencion.

P: Que es un MISSED nocturno?
a) Un residente que no fue encontrado en su cama
b) Un medicamento que no fue administrado a tiempo
*c) Una ronda que no fue completada dentro de la ventana de tiempo asignada
d) Un incidente que no fue reportado al supervisor
EXPLICACION: Un MISSED nocturno se genera cuando el cuidador no completa una ronda dentro del tiempo establecido, apareciendo en el dashboard del supervisor.

P: Se puede usar Override Forzado para completar una ronda nocturna retroactivamente?
a) Si, con autorizacion del supervisor remoto
b) Si, dentro de los primeros 30 minutos
*c) No, no existe Override Forzado para las rondas nocturnas
d) Si, pero genera una alerta especial
EXPLICACION: No existe Override Forzado para las rondas nocturnas. Si se retrasa, el cuidador debe documentar la razon en una nota aparte.

P: Ademas del estado del residente, que mas debe verificar el cuidador durante una ronda nocturna?
a) Que las luces del pasillo esten encendidas
*b) Temperatura de la habitacion, aire acondicionado o ventilador y estado de las barandas de cama
c) Que la puerta de la habitacion este cerrada con llave
d) Que el residente tenga agua en la mesa de noche
EXPLICACION: Las rondas nocturnas incluyen verificacion ambiental: temperatura, funcionamiento del aire acondicionado o ventilador y estado de las barandas de cama.

---SECCION_4---
LECTURA:
# Incidentes Nocturnos y Escalado Remoto

Un incidente nocturno es cualquier evento que altera la rutina normal del turno de noche: una caida, un episodio de agitacion, un residente que abandona su cama repetidamente o un problema medico. El cuidador nocturno debe documentar el incidente en Zendity inmediatamente, incluyendo hora, descripcion, acciones tomadas y estado del residente despues de la intervencion. Si el incidente requiere atencion medica o decision de un supervisor, Zendity activa el escalado remoto. El escalado remoto envia una notificacion push al supervisor de guardia con un resumen del incidente. El supervisor tiene 15 minutos para responder. Si no responde, Zendity escala automaticamente al Director. El cuidador no debe esperar la respuesta del supervisor para actuar en situaciones de emergencia. El protocolo es claro: primero atiendes al residente, luego documentas, luego escalas. Zendity registra la cadena completa de escalado con timestamps, creando un trail de auditoria que protege al cuidador y a la organizacion. Nunca tomes decisiones medicas sin documentar.

PREGUNTAS:
P: Cual es el orden correcto de accion ante un incidente nocturno?
a) Documentar, escalar, atender al residente
b) Escalar al supervisor, esperar instrucciones, atender al residente
*c) Atender al residente, documentar, escalar
d) Llamar al 911, documentar, notificar al supervisor
EXPLICACION: El protocolo es claro: primero atiendes al residente, luego documentas en Zendity, luego escalas si es necesario.

P: Cuanto tiempo tiene el supervisor remoto para responder a un escalado nocturno?
a) 5 minutos
b) 10 minutos
*c) 15 minutos
d) 30 minutos
EXPLICACION: El supervisor de guardia tiene 15 minutos para responder al escalado remoto. Si no responde, Zendity escala automaticamente al Director.

P: Que sucede si el supervisor no responde al escalado remoto dentro del tiempo establecido?
a) El cuidador debe llamar por telefono al supervisor
b) El incidente se cierra automaticamente
*c) Zendity escala automaticamente al Director
d) El cuidador debe manejar la situacion solo
EXPLICACION: Si el supervisor no responde en 15 minutos, Zendity escala automaticamente al siguiente nivel, que es el Director.

P: Que informacion debe incluir la documentacion de un incidente nocturno?
a) Solo la hora y una breve descripcion
b) Nombre del residente y numero de habitacion unicamente
*c) Hora, descripcion, acciones tomadas y estado del residente despues de la intervencion
d) Un formulario estandar con casillas de verificacion
EXPLICACION: La documentacion del incidente debe incluir hora exacta, descripcion del evento, acciones tomadas por el cuidador y el estado del residente despues de la intervencion.

P: Por que Zendity registra la cadena completa de escalado con timestamps?
a) Para calcular el tiempo de respuesta promedio del equipo
b) Para penalizar a los supervisores que no responden a tiempo
*c) Para crear un trail de auditoria que protege al cuidador y a la organizacion
d) Para generar estadisticas de incidentes nocturnos
EXPLICACION: El trail de auditoria con timestamps protege tanto al cuidador como a la organizacion al documentar exactamente que paso, cuando y quien respondio.

---SECCION_5---
LECTURA:
# Cierre del Turno a las 6am

El cierre del turno nocturno es tan critico como el inicio. A las 6am, Zendity presenta al cuidador una pantalla de cierre que resume todo lo ocurrido durante la noche: rondas completadas, incidentes documentados, items MISSED pendientes y notas generales. El cuidador debe revisar cada item y confirmar que la informacion es correcta y completa. Si hay items MISSED, Zendity exige una explicacion escrita antes de permitir el cierre. El sistema calcula automaticamente un score de cumplimiento nocturno basado en rondas completadas a tiempo, incidentes documentados correctamente y tiempo de respuesta. Este score es visible para el supervisor y forma parte de la evaluacion del cuidador. El cierre tambien genera automaticamente el Prologo del Turno para el cuidador diurno entrante. Si el cuidador nocturno no completa el cierre antes de que llegue el turno diurno, los items pendientes se transfieren como MISSED con alta prioridad. Un cierre limpio a las 6am es la mejor proteccion para el cuidador nocturno. Lo que no esta documentado, no paso.

PREGUNTAS:
P: Que presenta Zendity al cuidador a las 6am?
a) Una lista de tareas para el turno diurno
*b) Una pantalla de cierre que resume todo lo ocurrido durante la noche
c) Un formulario de evaluacion del turno
d) Las instrucciones del supervisor para el proximo turno
EXPLICACION: A las 6am, Zendity presenta una pantalla de cierre con el resumen de rondas, incidentes, items MISSED y notas del turno nocturno.

P: Que debe hacer el cuidador si tiene items MISSED al momento del cierre?
a) Marcarlos como completados para cerrar el turno
b) Ignorarlos y dejar que el turno diurno los resuelva
*c) Escribir una explicacion para cada item MISSED antes de cerrar
d) Llamar al supervisor para que los elimine del sistema
EXPLICACION: Zendity exige una explicacion escrita para cada item MISSED antes de permitir el cierre del turno nocturno.

P: Que genera automaticamente el cierre del turno nocturno?
a) Un reporte para la auditoria estatal
b) Una evaluacion de desempeno del cuidador
*c) El Prologo del Turno para el cuidador diurno entrante
d) Una lista de compras de suministros necesarios
EXPLICACION: El cierre del turno nocturno genera automaticamente el Prologo del Turno que el cuidador diurno revisara al iniciar su jornada.

P: Que factores considera el score de cumplimiento nocturno?
a) Solo el numero de rondas completadas
b) La cantidad de incidentes reportados durante la noche
*c) Rondas completadas a tiempo, incidentes documentados correctamente y tiempo de respuesta
d) La evaluacion subjetiva del supervisor remoto
EXPLICACION: El score de cumplimiento nocturno se calcula con base en rondas completadas a tiempo, calidad de documentacion de incidentes y tiempo de respuesta.

P: Que sucede si el cuidador nocturno no completa el cierre antes de la llegada del turno diurno?
a) El supervisor completa el cierre por el
b) El cierre se pospone hasta que el cuidador lo complete desde su casa
*c) Los items pendientes se transfieren como MISSED con alta prioridad al turno diurno
d) El sistema cierra automaticamente el turno sin revision
EXPLICACION: Si el cierre no se completa, los items pendientes se transfieren como MISSED con prioridad alta al turno diurno, afectando el score del cuidador nocturno.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 14: PLANTA FISICA Y MANTENIMIENTO EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'PLANTA_FISICA_101',
    title: 'Planta Fisica y Mantenimiento en Zendity',
    description: 'Gestion de mantenimiento en Zendity: tickets de dano, mantenimiento preventivo, SLA y emergencias de infraestructura.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🔧',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: Planta Fisica y Mantenimiento en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende el flujo de trabajo de mantenimiento en Zendity, incluyendo creacion de tickets, prioridades SLA y manejo de emergencias.
TERMINOS_CLAVE: ticket de dano, mantenimiento preventivo, cotizacion, SLA, calendario de inspecciones, emergencia de infraestructura, Maintenance Hub, evidencia fotografica, presupuesto, coordinacion supervisor
PREGUNTA_REFLEXION: Detectas una fuga de agua en el bano del segundo piso a las 11pm. El Director no esta disponible. Como lo manejas en Zendity?

---SECCION_1---
LECTURA:
# El Modulo de Planta Fisica en Zendity

El modulo de Planta Fisica, conocido internamente como Maintenance Hub, es el centro de operaciones para todo lo relacionado con la infraestructura del hogar de cuido. Desde una gotera en el techo hasta el reemplazo de un generador electrico, todo se gestiona aqui. El Maintenance Hub tiene cuatro areas principales: Tickets Activos, Mantenimiento Preventivo, Calendario de Inspecciones y Emergencias. Cada empleado del hogar puede crear un ticket de dano cuando detecta un problema de infraestructura, pero solo el supervisor o el Director pueden aprobar trabajos que requieran presupuesto. Zendity clasifica automaticamente los tickets segun su severidad: baja, media, alta y critica. La severidad determina el SLA, es decir, el tiempo maximo en que el problema debe ser atendido. El Maintenance Hub no es solo para el equipo de mantenimiento. Cuidadores, enfermeras y personal administrativo interactuan con el diariamente al reportar danos, verificar reparaciones y confirmar que las areas estan seguras para los residentes.

PREGUNTAS:
P: Cuales son las cuatro areas principales del Maintenance Hub?
a) Reportes, Alertas, Historial y Configuracion
*b) Tickets Activos, Mantenimiento Preventivo, Calendario de Inspecciones y Emergencias
c) Danos, Reparaciones, Compras y Auditorias
d) Personal, Equipos, Materiales y Presupuesto
EXPLICACION: El Maintenance Hub se organiza en Tickets Activos, Mantenimiento Preventivo, Calendario de Inspecciones y Emergencias.

P: Quien puede crear un ticket de dano en Zendity?
a) Solo el equipo de mantenimiento
b) Solo el supervisor o el Director
*c) Cualquier empleado del hogar
d) Solo los cuidadores durante su turno
EXPLICACION: Cualquier empleado del hogar puede crear un ticket de dano cuando detecta un problema de infraestructura.

P: Quien puede aprobar trabajos de mantenimiento que requieran presupuesto?
a) Cualquier empleado que creo el ticket
b) El equipo de mantenimiento
*c) Solo el supervisor o el Director
d) Zendity lo aprueba automaticamente
EXPLICACION: Solo el supervisor o el Director pueden aprobar trabajos que requieran presupuesto, manteniendo control financiero sobre las reparaciones.

P: Como clasifica Zendity la severidad de los tickets de mantenimiento?
a) Urgente y no urgente
b) Prioridad 1, 2 y 3
*c) Baja, media, alta y critica
d) Verde, amarillo y rojo
EXPLICACION: Zendity clasifica los tickets en cuatro niveles de severidad: baja, media, alta y critica, cada uno con su propio SLA.

P: Por que el Maintenance Hub no es exclusivo del equipo de mantenimiento?
a) Porque todos deben aprender a reparar cosas basicas
*b) Porque cuidadores, enfermeras y administrativos reportan danos, verifican reparaciones y confirman seguridad de areas
c) Porque Zendity requiere que todos completen tareas de mantenimiento
d) Porque el equipo de mantenimiento no tiene acceso directo al sistema
EXPLICACION: Todo el personal interactua con el Maintenance Hub al reportar danos, verificar reparaciones completadas y confirmar que las areas son seguras para los residentes.

---SECCION_2---
LECTURA:
# Tickets de Dano y Prioridades

Un ticket de dano es el mecanismo formal para reportar cualquier problema de infraestructura en Zendity. Para crear un ticket, el empleado debe incluir: ubicacion exacta del dano, descripcion del problema, al menos una foto de evidencia y una estimacion de severidad. Zendity puede ajustar la severidad automaticamente basandose en la ubicacion y el tipo de dano. Por ejemplo, un problema electrico en una habitacion de residente se eleva automaticamente a severidad alta. Cada nivel de severidad tiene un SLA definido. Severidad baja tiene un SLA de 72 horas. Severidad media, 48 horas. Severidad alta, 24 horas. Severidad critica, 4 horas. El SLA comienza a contar desde el momento en que el ticket es creado, no desde que es asignado. Si un ticket excede su SLA, Zendity escala automaticamente al Director con una alerta roja. Los tickets pueden incluir una cotizacion si el trabajo requiere materiales o un contratista externo. La cotizacion debe ser aprobada por el Director antes de que el trabajo comience.

PREGUNTAS:
P: Que informacion minima debe incluir un ticket de dano?
a) Solo la descripcion del problema
b) Ubicacion y descripcion
*c) Ubicacion exacta, descripcion, al menos una foto de evidencia y estimacion de severidad
d) Nombre del empleado que reporta y ubicacion
EXPLICACION: Un ticket de dano completo requiere ubicacion exacta, descripcion del problema, evidencia fotografica y estimacion de severidad.

P: Cual es el SLA para un ticket de severidad critica?
a) 1 hora
*b) 4 horas
c) 12 horas
d) 24 horas
EXPLICACION: Los tickets de severidad critica tienen un SLA de 4 horas, el mas corto de todos los niveles de prioridad.

P: Desde cuando comienza a contar el SLA de un ticket?
a) Desde que es asignado a un tecnico
*b) Desde el momento en que el ticket es creado
c) Desde que el supervisor lo aprueba
d) Desde el inicio del siguiente dia laboral
EXPLICACION: El SLA comienza a contar desde el momento de creacion del ticket, no desde su asignacion, lo que incentiva una respuesta rapida.

P: Que hace Zendity automaticamente con un problema electrico reportado en una habitacion de residente?
a) Lo marca como resuelto si no hay peligro inmediato
b) Lo asigna al electricista de guardia
*c) Lo eleva automaticamente a severidad alta
d) Lo envia directamente al Director
EXPLICACION: Zendity ajusta la severidad automaticamente basandose en la ubicacion y tipo de dano. Un problema electrico en habitacion de residente se eleva a severidad alta.

P: Que sucede cuando un ticket excede su SLA?
a) Se cierra automaticamente con una nota de retraso
b) Se asigna a otro tecnico disponible
*c) Zendity escala automaticamente al Director con una alerta roja
d) El SLA se extiende por 24 horas adicionales
EXPLICACION: Los tickets que exceden su SLA generan un escalado automatico al Director con alerta roja para garantizar atencion inmediata.

---SECCION_3---
LECTURA:
# Mantenimiento Preventivo y Calendario

El mantenimiento preventivo es la estrategia mas efectiva para evitar emergencias de infraestructura. Zendity incluye un modulo de Mantenimiento Preventivo con un calendario de inspecciones programadas. El calendario se configura inicialmente con el Director y cubre todas las areas criticas del hogar: sistema electrico, plomeria, aire acondicionado, generador de emergencia, extintores, detectores de humo y equipos de cocina. Cada inspeccion tiene una frecuencia definida: semanal, quincenal, mensual o trimestral. Zendity genera automaticamente las tareas de inspeccion y las asigna al personal de mantenimiento. Si una tarea de mantenimiento preventivo no se completa en su fecha programada, el sistema la marca como vencida y notifica al supervisor. El mantenimiento preventivo tambien incluye la revision de areas comunes: pasamanos, pisos, iluminacion, cerraduras y rampas de accesibilidad. Cada inspeccion completada requiere evidencia fotografica y un checklist firmado digitalmente. El historial de mantenimiento preventivo es auditado por las agencias reguladoras y su cumplimiento afecta directamente la licencia del hogar.

PREGUNTAS:
P: Que areas criticas cubre el calendario de mantenimiento preventivo?
a) Solo el sistema electrico y la plomeria
b) Habitaciones de residentes y areas comunes
*c) Sistema electrico, plomeria, aire acondicionado, generador, extintores, detectores de humo y equipos de cocina
d) Solo los equipos medicos y de emergencia
EXPLICACION: El calendario cubre todas las areas criticas de infraestructura incluyendo sistemas electricos, plomeria, climatizacion, generador, equipos de seguridad y cocina.

P: Que frecuencias de inspeccion maneja Zendity para mantenimiento preventivo?
a) Solo mensual y anual
b) Diaria y semanal
*c) Semanal, quincenal, mensual o trimestral
d) Depende del criterio del supervisor
EXPLICACION: Las inspecciones de mantenimiento preventivo pueden programarse con frecuencia semanal, quincenal, mensual o trimestral segun el area.

P: Que sucede si una tarea de mantenimiento preventivo no se completa en su fecha programada?
a) Se reprograma automaticamente para la proxima semana
*b) Se marca como vencida y se notifica al supervisor
c) Se elimina del calendario y se genera un reporte
d) Se asigna a otro miembro del equipo automaticamente
EXPLICACION: Las tareas vencidas se marcan como tales y el supervisor recibe una notificacion para tomar accion inmediata.

P: Que se requiere para completar una inspeccion de mantenimiento preventivo en Zendity?
a) Solo la firma del tecnico de mantenimiento
b) Un reporte escrito detallado
*c) Evidencia fotografica y un checklist firmado digitalmente
d) La aprobacion verbal del supervisor
EXPLICACION: Cada inspeccion completada requiere evidencia fotografica y un checklist firmado digitalmente como prueba de cumplimiento.

P: Por que es importante el cumplimiento del mantenimiento preventivo para el hogar?
a) Solo para mantener un buen record interno
b) Para reducir los costos de operacion
*c) Porque es auditado por agencias reguladoras y afecta directamente la licencia del hogar
d) Para que Zendity genere mejores reportes
EXPLICACION: El historial de mantenimiento preventivo es auditado por agencias reguladoras y su cumplimiento es un factor directo en la renovacion de la licencia del hogar.

---SECCION_4---
LECTURA:
# SLA y Evidencia Fotografica

El sistema de SLA en Zendity no es solo un temporizador. Es una herramienta de accountability que conecta cada ticket de mantenimiento con un compromiso de tiempo medible. Cada vez que un tecnico trabaja en un ticket, debe actualizar el estado: en progreso, esperando materiales, esperando cotizacion o completado. Si un ticket esta en estado de espera por mas de 24 horas sin actualizacion, Zendity envia un recordatorio al tecnico y al supervisor. La evidencia fotografica es obligatoria en dos momentos: al crear el ticket y al cerrarlo. La foto de apertura documenta el problema tal como fue encontrado. La foto de cierre documenta la reparacion completada. Zendity compara ambas fotos y las archiva junto al ticket. Sin la foto de cierre, el ticket no puede marcarse como completado. Esta regla existe porque las auditorias regulatorias exigen prueba visual de que los problemas fueron efectivamente resueltos. El sistema tambien permite adjuntar fotos intermedias durante el progreso del trabajo, especialmente util para reparaciones complejas que toman varios dias.

PREGUNTAS:
P: Que estados puede tener un ticket de mantenimiento en progreso?
a) Abierto, cerrado y archivado
*b) En progreso, esperando materiales, esperando cotizacion o completado
c) Pendiente, asignado, resuelto y verificado
d) Nuevo, activo y finalizado
EXPLICACION: Los estados disponibles son: en progreso, esperando materiales, esperando cotizacion o completado, permitiendo rastreo preciso del avance.

P: En que dos momentos es obligatoria la evidencia fotografica?
a) Al asignar el ticket y al verificar la reparacion
*b) Al crear el ticket y al cerrarlo
c) Antes y despues de comprar materiales
d) Al iniciar el turno y al finalizar el turno
EXPLICACION: La evidencia fotografica es obligatoria al crear el ticket (documentando el problema) y al cerrarlo (documentando la reparacion completada).

P: Que sucede si un tecnico no sube la foto de cierre al completar una reparacion?
a) El supervisor debe aprobar el cierre sin foto
b) El sistema acepta el cierre con una nota explicativa
*c) El ticket no puede marcarse como completado
d) Se genera una penalizacion automatica al tecnico
EXPLICACION: Sin la foto de cierre, Zendity no permite marcar el ticket como completado, asegurando que toda reparacion quede documentada visualmente.

P: Que ocurre si un ticket esta en espera por mas de 24 horas sin actualizacion?
a) Se cierra automaticamente por inactividad
*b) Zendity envia un recordatorio al tecnico y al supervisor
c) Se escala directamente al Director
d) Se reduce la severidad del ticket
EXPLICACION: Si un ticket permanece en espera sin actualizacion por mas de 24 horas, Zendity envia recordatorios tanto al tecnico como al supervisor.

P: Por que las auditorias regulatorias exigen evidencia fotografica de reparaciones?
a) Para verificar que se usaron materiales de calidad
b) Para calcular los costos de mantenimiento
*c) Para tener prueba visual de que los problemas fueron efectivamente resueltos
d) Para evaluar el desempeno del equipo de mantenimiento
EXPLICACION: Las agencias reguladoras requieren prueba visual de que los problemas de infraestructura fueron resueltos, no solo documentacion escrita.

---SECCION_5---
LECTURA:
# Emergencias de Infraestructura

Una emergencia de infraestructura es un evento que pone en riesgo inmediato la seguridad de los residentes o la operacion del hogar. Ejemplos incluyen: falla del generador electrico durante un apagon, inundacion por rotura de tuberia, dano estructural por tormenta o falla del sistema de aire acondicionado en temporada de calor extremo. Zendity tiene un boton de Emergencia de Infraestructura que activa un protocolo especial. Al presionarlo, el sistema notifica simultaneamente al Director, al supervisor de turno y al contacto de emergencia de mantenimiento. El ticket de emergencia tiene un SLA de 4 horas y no requiere cotizacion previa para iniciar trabajos de contencion. El empleado que reporta la emergencia debe incluir fotos, una descripcion del riesgo inmediato y las acciones de contencion ya tomadas. Zendity genera automaticamente un checklist de seguridad post-emergencia que debe completarse antes de reabrir el area afectada. Este checklist incluye verificacion de seguridad electrica, estructural y sanitaria. Las emergencias de infraestructura se reportan automaticamente a las agencias reguladoras si afectan areas de residentes.

PREGUNTAS:
P: Que define una emergencia de infraestructura en Zendity?
a) Cualquier dano que requiera un contratista externo
b) Un ticket que excede su SLA original
*c) Un evento que pone en riesgo inmediato la seguridad de los residentes o la operacion del hogar
d) Una solicitud del Director para reparacion urgente
EXPLICACION: Una emergencia de infraestructura es un evento con riesgo inmediato para la seguridad de residentes o la operacion del hogar, como fallas electricas, inundaciones o dano estructural.

P: A quienes notifica Zendity cuando se activa el boton de Emergencia de Infraestructura?
a) Solo al Director
b) Al supervisor de turno y al equipo de mantenimiento
*c) Al Director, al supervisor de turno y al contacto de emergencia de mantenimiento
d) A todos los empleados del hogar
EXPLICACION: El boton de emergencia notifica simultaneamente al Director, supervisor de turno y contacto de emergencia de mantenimiento para respuesta coordinada.

P: Se requiere cotizacion previa para iniciar trabajos de contencion en una emergencia?
a) Si, siempre se requiere cotizacion aprobada
b) Solo si el costo excede $500
*c) No, las emergencias no requieren cotizacion previa para contencion
d) Solo si el Director no esta disponible
EXPLICACION: En emergencias de infraestructura, los trabajos de contencion pueden iniciarse sin cotizacion previa, priorizando la seguridad sobre el proceso administrativo.

P: Que debe completarse antes de reabrir un area afectada por una emergencia?
a) Una reunion con el equipo de mantenimiento
b) La aprobacion escrita del Director
*c) Un checklist de seguridad post-emergencia que incluye verificacion electrica, estructural y sanitaria
d) Una inspeccion por un contratista externo certificado
EXPLICACION: Zendity genera un checklist de seguridad post-emergencia con verificacion electrica, estructural y sanitaria que debe completarse antes de reabrir el area.

P: Que sucede si una emergencia de infraestructura afecta areas donde viven residentes?
a) Se evacuan los residentes automaticamente
b) El Director debe notificar a los familiares personalmente
*c) Zendity reporta automaticamente la emergencia a las agencias reguladoras
d) Se suspenden todas las operaciones del hogar hasta la reparacion
EXPLICACION: Las emergencias que afectan areas de residentes se reportan automaticamente a las agencias reguladoras, cumpliendo con los requisitos de notificacion obligatoria.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 15: LIMPIEZA Y SANITIZACION EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'LIMPIEZA_101',
    title: 'Limpieza y Sanitizacion en Zendity',
    description: 'Protocolo de limpieza en Zendity: registro de areas, evidencia fotografica, solicitudes urgentes y metricas de desempeno.',
    durationMins: 20,
    bonusCompliance: 10,
    emoji: '🧹',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: Limpieza y Sanitizacion en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende el flujo de trabajo de limpieza en Zendity, incluyendo registro de areas, evidencia fotografica obligatoria y metricas de cumplimiento.
TERMINOS_CLAVE: Mi Turno, area registrada, evidencia fotografica, solicitud urgente, SLA 45 minutos, metricas de desempeno, Zendi logica de evidencia, historial de limpieza, score de cumplimiento, pendientes
PREGUNTA_REFLEXION: Terminaste de limpiar el comedor pero el sistema no te deja marcar el area como completada porque falta la foto de evidencia. Que haces?

---SECCION_1---
LECTURA:
# El Modulo de Limpieza en Zendity

El modulo de Limpieza en Zendity gestiona todo el flujo de trabajo de sanitizacion del hogar de cuido. Este modulo fue disenado para garantizar que cada area del hogar se limpie con la frecuencia correcta y con evidencia verificable. El modulo se centra en la pantalla Mi Turno, donde cada empleado de limpieza ve sus areas asignadas para el dia, con horarios especificos y niveles de prioridad. Las areas se clasifican en tres categorias: areas de residentes (habitaciones y banos), areas comunes (comedor, sala, pasillos) y areas de servicio (cocina, lavanderia, almacen). Cada categoria tiene frecuencias de limpieza distintas y estandares de sanitizacion especificos. Zendity no permite que un area se marque como limpia sin evidencia fotografica. Esta regla, conocida internamente como la Zendi logica de evidencia, existe porque las agencias reguladoras exigen prueba documental de cumplimiento sanitario. El modulo tambien conecta con el historial de limpieza, permitiendo rastrear patrones, identificar areas problematicas y generar reportes para auditorias.

PREGUNTAS:
P: Cual es la pantalla principal del modulo de Limpieza para el empleado?
a) Dashboard de Limpieza
b) Control de Areas
*c) Mi Turno
d) Panel de Sanitizacion
EXPLICACION: Mi Turno es la pantalla principal donde cada empleado de limpieza ve sus areas asignadas con horarios y niveles de prioridad.

P: En que tres categorias se clasifican las areas de limpieza?
a) Criticas, normales y opcionales
b) Interiores, exteriores y de emergencia
*c) Areas de residentes, areas comunes y areas de servicio
d) Publicas, privadas y restringidas
EXPLICACION: Las areas se clasifican en areas de residentes (habitaciones y banos), areas comunes (comedor, sala, pasillos) y areas de servicio (cocina, lavanderia, almacen).

P: Que es la Zendi logica de evidencia?
a) Un algoritmo que detecta areas sucias automaticamente
b) Un sensor que mide niveles de limpieza
*c) La regla que impide marcar un area como limpia sin evidencia fotografica
d) Un sistema de puntos que premia la limpieza rapida
EXPLICACION: La Zendi logica de evidencia es la regla del sistema que no permite marcar un area como limpia sin subir una foto de evidencia.

P: Por que Zendity exige evidencia fotografica para cada area limpiada?
a) Para que el supervisor pueda verificar la calidad remotamente
b) Para crear contenido visual para los reportes mensuales
*c) Porque las agencias reguladoras exigen prueba documental de cumplimiento sanitario
d) Para entrenar al personal nuevo sobre estandares de limpieza
EXPLICACION: Las agencias reguladoras exigen prueba documental de cumplimiento sanitario, y la evidencia fotografica cumple ese requisito.

P: Para que sirve el historial de limpieza en Zendity?
a) Solo para generar reportes mensuales
*b) Para rastrear patrones, identificar areas problematicas y generar reportes de auditoria
c) Para calcular el salario del personal de limpieza
d) Para comparar el desempeno entre diferentes hogares
EXPLICACION: El historial permite rastrear patrones de limpieza, identificar areas problematicas recurrentes y generar los reportes necesarios para auditorias regulatorias.

---SECCION_2---
LECTURA:
# Mi Turno y Areas Asignadas

Al iniciar su jornada, el empleado de limpieza accede a Mi Turno y ve una lista ordenada por prioridad de todas las areas que debe limpiar. Cada area muestra su nombre, ubicacion, hora estimada de limpieza, nivel de prioridad y estado actual: pendiente, en progreso o completada. El empleado debe marcar cada area como en progreso al comenzar y como completada al terminar, subiendo la foto de evidencia. Las areas de residentes siempre tienen prioridad maxima, especialmente las habitaciones de residentes con condiciones de salud que requieren sanitizacion especial. Zendity asigna las areas basandose en la zona del hogar y la carga de trabajo balanceada. Si un empleado no puede completar un area dentro de su ventana de tiempo, el sistema la marca como pendiente y la reasigna o la escala al supervisor. Mi Turno tambien muestra las solicitudes urgentes que pueden surgir durante el dia, como derrames, accidentes o preparacion de habitaciones para nuevos residentes. Estas solicitudes se insertan en la lista con prioridad alta y tienen su propio SLA.

PREGUNTAS:
P: Que informacion muestra cada area en la pantalla Mi Turno?
a) Solo el nombre del area y la hora
*b) Nombre, ubicacion, hora estimada, nivel de prioridad y estado actual
c) Nombre del area, productos a usar y tiempo estimado
d) Ubicacion, responsable anterior y fecha de ultima limpieza
EXPLICACION: Cada area en Mi Turno muestra nombre, ubicacion, hora estimada de limpieza, nivel de prioridad y estado (pendiente, en progreso o completada).

P: Que areas siempre tienen prioridad maxima en el modulo de limpieza?
a) Las areas comunes por su alto trafico
b) La cocina por regulaciones de salud
*c) Las areas de residentes, especialmente habitaciones con condiciones de salud especiales
d) Las areas de servicio por su importancia operativa
EXPLICACION: Las areas de residentes siempre tienen prioridad maxima, especialmente las habitaciones de residentes con condiciones de salud que requieren sanitizacion especial.

P: Que debe hacer el empleado al comenzar la limpieza de un area?
a) Tomar la foto de evidencia antes de limpiar
*b) Marcar el area como en progreso en Zendity
c) Notificar al supervisor que va a iniciar
d) Verificar que los productos de limpieza estan disponibles
EXPLICACION: El empleado debe marcar el area como en progreso al comenzar y como completada al terminar, subiendo la evidencia fotografica.

P: Que pasa si el empleado no completa un area dentro de su ventana de tiempo?
a) Se cierra automaticamente como completada
b) Se elimina de la lista del dia
*c) Se marca como pendiente y se reasigna o se escala al supervisor
d) Se pospone automaticamente para el dia siguiente
EXPLICACION: Las areas no completadas en su ventana de tiempo se marcan como pendientes y el sistema las reasigna a otro empleado o las escala al supervisor.

P: Como maneja Mi Turno las solicitudes urgentes que surgen durante el dia?
a) Las coloca al final de la lista del empleado
b) Las envia solo al supervisor para que las asigne
*c) Las inserta en la lista con prioridad alta y con su propio SLA
d) Las pospone hasta que el empleado termine sus areas regulares
EXPLICACION: Las solicitudes urgentes se insertan directamente en Mi Turno con prioridad alta y tienen su propio SLA para garantizar atencion rapida.

---SECCION_3---
LECTURA:
# Evidencia Fotografica y Validacion

La evidencia fotografica es el pilar del modulo de Limpieza en Zendity. Cada area completada requiere al menos una foto que muestre el estado final despues de la limpieza. Zendity aplica la Zendi logica de evidencia con reglas especificas. La foto debe ser tomada desde la app de Zendity, no se aceptan fotos de la galeria del telefono. Esto garantiza que la foto tiene timestamp y geolocalizacion verificables. La foto debe mostrar el area completa, no solo un detalle. Zendity rechaza automaticamente fotos borrosas, oscuras o que no corresponden al area asignada usando validacion basica de imagen. Si la foto es rechazada, el empleado recibe una notificacion con la razon del rechazo y debe tomar una nueva foto. El supervisor puede revisar las fotos de evidencia en tiempo real desde su dashboard. Si detecta que un area no cumple con los estandares de limpieza a pesar de tener foto, puede reabrir el area y asignarla nuevamente. El historial fotografico de cada area se archiva por 12 meses para auditorias regulatorias.

PREGUNTAS:
P: Por que Zendity no acepta fotos de la galeria del telefono como evidencia?
a) Porque las fotos de galeria tienen menor calidad
b) Porque podrian ser fotos de otro hogar de cuido
*c) Porque las fotos desde la app tienen timestamp y geolocalizacion verificables
d) Porque la galeria del telefono no es segura
EXPLICACION: Las fotos tomadas desde la app de Zendity incluyen timestamp y geolocalizacion verificables, garantizando que se tomaron en el lugar y momento correctos.

P: Que hace Zendity si la foto de evidencia es borrosa u oscura?
a) La acepta con una advertencia al supervisor
b) La mejora automaticamente con filtros
*c) La rechaza automaticamente y notifica al empleado con la razon del rechazo
d) La envia al supervisor para revision manual
EXPLICACION: Zendity rechaza automaticamente fotos que no cumplen los estandares de calidad y notifica al empleado para que tome una nueva foto.

P: Que puede hacer el supervisor si detecta que un area no cumple estandares a pesar de tener foto?
a) Eliminar la foto y cerrar el area
b) Enviar una amonestacion al empleado
*c) Reabrir el area y asignarla nuevamente para que se limpie correctamente
d) Aceptar la foto y agregar una nota de mejora
EXPLICACION: El supervisor puede reabrir un area y asignarla nuevamente si determina que la limpieza no cumple con los estandares, a pesar de que se haya subido una foto.

P: Cuanto tiempo se archiva el historial fotografico de cada area?
a) 3 meses
b) 6 meses
*c) 12 meses
d) Indefinidamente
EXPLICACION: El historial fotografico se archiva por 12 meses para cumplir con los requisitos de auditorias regulatorias.

P: Que debe mostrar la foto de evidencia de un area limpiada?
a) Un primer plano del piso limpio
b) Los productos de limpieza utilizados
*c) El area completa, no solo un detalle
d) Al empleado senalando el area limpiada
EXPLICACION: La foto debe mostrar el area completa para verificar que toda la zona fue limpiada, no solo una seccion o detalle.

---SECCION_4---
LECTURA:
# Solicitudes Urgentes y SLA

Las solicitudes urgentes son pedidos de limpieza no programados que surgen por eventos inesperados: un derrame en el comedor, un accidente en una habitacion, preparacion de una habitacion para un nuevo residente o una visita de inspeccion no anunciada. Cualquier empleado del hogar puede crear una solicitud urgente desde Zendity, no solo el personal de limpieza. La solicitud urgente tiene un SLA de 45 minutos, lo que significa que el personal de limpieza debe responder y completar la tarea dentro de ese tiempo. Zendity asigna la solicitud al empleado de limpieza mas cercano a la ubicacion del evento, basandose en la zona asignada. Si el empleado asignado no acepta la solicitud en 10 minutos, Zendity la reasigna al siguiente empleado disponible. Las solicitudes urgentes requieren la misma evidencia fotografica que las areas regulares. Al completar una solicitud urgente, el empleado debe documentar que causo la situacion si lo sabe, que acciones tomo y subir la foto de evidencia. El cumplimiento del SLA de solicitudes urgentes es una metrica clave en la evaluacion del equipo de limpieza.

PREGUNTAS:
P: Cual es el SLA para solicitudes urgentes de limpieza?
a) 15 minutos
b) 30 minutos
*c) 45 minutos
d) 60 minutos
EXPLICACION: Las solicitudes urgentes tienen un SLA de 45 minutos desde su creacion hasta su completacion.

P: Quien puede crear una solicitud urgente de limpieza en Zendity?
a) Solo el personal de limpieza
b) Solo el supervisor de turno
*c) Cualquier empleado del hogar
d) Solo el Director
EXPLICACION: Cualquier empleado del hogar puede crear una solicitud urgente, no solo el personal de limpieza, permitiendo reporte rapido desde cualquier area.

P: Como asigna Zendity una solicitud urgente al personal de limpieza?
a) Al empleado con menos tareas pendientes
b) Al empleado que esta en su hora de descanso
*c) Al empleado de limpieza mas cercano a la ubicacion del evento
d) Aleatoriamente entre todos los empleados disponibles
EXPLICACION: Zendity asigna la solicitud al empleado de limpieza mas cercano basandose en la zona asignada para minimizar tiempo de respuesta.

P: Que sucede si el empleado asignado no acepta la solicitud urgente en 10 minutos?
a) La solicitud se cancela automaticamente
b) Se notifica al supervisor para que la asigne manualmente
*c) Zendity la reasigna al siguiente empleado disponible
d) Se extiende el SLA por 30 minutos adicionales
EXPLICACION: Si el primer empleado no acepta en 10 minutos, Zendity reasigna automaticamente la solicitud al siguiente empleado disponible para cumplir el SLA.

P: Que debe documentar el empleado al completar una solicitud urgente?
a) Solo la foto de evidencia
b) Solo que la situacion fue resuelta
*c) Que causo la situacion, que acciones tomo y la foto de evidencia
d) El nombre de quien creo la solicitud y la hora de completacion
EXPLICACION: Al completar una solicitud urgente, se debe documentar la causa (si se conoce), las acciones tomadas y la foto de evidencia del area limpia.

---SECCION_5---
LECTURA:
# Metricas de Desempeno y Score de Cumplimiento

Zendity mide el desempeno del equipo de limpieza a traves de metricas objetivas que se consolidan en un score de cumplimiento individual y grupal. Las metricas principales son: porcentaje de areas completadas a tiempo, porcentaje de solicitudes urgentes resueltas dentro del SLA, calidad de evidencia fotografica aceptada al primer intento y numero de areas reabietas por el supervisor. El score de cumplimiento se calcula semanalmente y se presenta en un rango de 0 a 100. Un score por encima de 85 se considera excelente. Entre 70 y 84 es aceptable. Por debajo de 70 requiere un plan de mejora con el supervisor. El supervisor accede a un dashboard grupal que muestra el score de cada empleado, las tendencias semanales y las areas que consistentemente presentan problemas. Zendity tambien genera alertas automaticas cuando un empleado tiene tres o mas pendientes sin completar al final de su turno. Estas metricas no son punitivas. Su objetivo es identificar donde el equipo necesita mas recursos, mejor capacitacion o ajustes en la distribucion de areas. Un score bajo puede indicar sobrecarga de trabajo, no necesariamente bajo desempeno.

PREGUNTAS:
P: Cuales son las metricas principales que mide Zendity para el equipo de limpieza?
a) Velocidad de limpieza y consumo de productos
*b) Areas completadas a tiempo, solicitudes urgentes en SLA, calidad de fotos y areas reabiertas
c) Numero de areas asignadas y completadas por dia
d) Satisfaccion de residentes y quejas recibidas
EXPLICACION: Las metricas principales son: areas completadas a tiempo, solicitudes urgentes dentro del SLA, calidad de evidencia fotografica y numero de areas reabiertas por supervisor.

P: Que rango de score de cumplimiento se considera excelente?
a) 90 a 100
*b) Por encima de 85
c) 80 a 100
d) Por encima de 95
EXPLICACION: Un score por encima de 85 se considera excelente en el sistema de metricas de limpieza de Zendity.

P: Que sucede cuando un empleado tiene un score de cumplimiento por debajo de 70?
a) Recibe una amonestacion formal
b) Se reduce su carga de trabajo automaticamente
*c) Se requiere un plan de mejora con el supervisor
d) Se le reasignan solo areas de baja prioridad
EXPLICACION: Un score por debajo de 70 requiere elaborar un plan de mejora con el supervisor para identificar y resolver las causas del bajo cumplimiento.

P: Cuando genera Zendity alertas automaticas sobre pendientes de limpieza?
a) Cuando un area lleva mas de 48 horas sin limpiar
b) Cuando el score semanal baja del promedio grupal
*c) Cuando un empleado tiene tres o mas pendientes sin completar al final de su turno
d) Cuando el supervisor solicita una revision
EXPLICACION: Zendity genera alertas automaticas cuando un empleado termina su turno con tres o mas areas pendientes sin completar.

P: Por que un score bajo de cumplimiento no necesariamente indica bajo desempeno?
a) Porque el sistema tiene errores de calculo frecuentes
b) Porque los supervisores ajustan los scores manualmente
*c) Porque puede indicar sobrecarga de trabajo o necesidad de mas recursos
d) Porque el score no considera la calidad de la limpieza
EXPLICACION: Un score bajo puede ser sintoma de sobrecarga de trabajo, necesidad de mas recursos o ajustes en la distribucion de areas, no solo de bajo desempeno individual.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 16: TRABAJO SOCIAL EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'TRABAJO_SOCIAL_101',
    title: 'Trabajo Social en Zendity',
    description: 'Herramientas de trabajo social en Zendity: dashboard global, beneficios, coordinacion de especialistas y alertas automaticas.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🫂',
    category: 'Protocolos Operativos',
    content: `---META---
TITULO: Trabajo Social en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende las herramientas de trabajo social en Zendity, incluyendo el dashboard global, seguimiento de beneficios y coordinacion de servicios.
TERMINOS_CLAVE: Zendi TS, dashboard global, perfil del residente, beneficios por vencer, especialistas, tareas pendientes, expediente, onboarding inicial, alertas automaticas, coordinacion de servicios
PREGUNTA_REFLEXION: Un residente tiene 2 beneficios medicos que vencen en 15 dias y no has podido coordinar la renovacion. Zendity envio alertas automaticas pero no hubo accion. Que haces?

---SECCION_1---
LECTURA:
# Trabajo Social en Zendity

El modulo de Trabajo Social en Zendity, conocido como Zendi TS, es la herramienta central para los trabajadores sociales del hogar de cuido. Este modulo reconoce que el trabajo social en un hogar de envejecientes va mucho mas alla de la asistencia basica. Incluye gestion de beneficios gubernamentales, coordinacion con especialistas medicos, seguimiento de casos activos y documentacion del expediente social de cada residente. Zendi TS presenta un dashboard global que muestra en tiempo real el estado de todos los residentes bajo la responsabilidad del trabajador social: beneficios proximos a vencer, citas pendientes con especialistas, tareas atrasadas y alertas automaticas. El dashboard esta disenado para que el trabajador social pueda priorizar su dia con un solo vistazo. Cada residente tiene un perfil completo que incluye su historial social, contactos familiares, beneficios activos, necesidades especiales y notas clinicas relevantes. Zendi TS no reemplaza el juicio profesional del trabajador social, pero le da las herramientas para que ninguna tarea critica se pierda en la complejidad del dia a dia.

PREGUNTAS:
P: Que es Zendi TS?
a) Un asistente virtual de inteligencia artificial para trabajo social
*b) El modulo de Trabajo Social en Zendity, herramienta central para trabajadores sociales
c) Un sistema de mensajeria entre trabajadores sociales y familias
d) Un programa de capacitacion para trabajadores sociales
EXPLICACION: Zendi TS es el modulo de Trabajo Social en Zendity, disenado como herramienta central para gestionar todas las funciones del trabajador social en el hogar.

P: Que informacion muestra el dashboard global de Zendi TS?
a) Solo los beneficios activos de cada residente
b) Unicamente las citas pendientes con especialistas
*c) Beneficios proximos a vencer, citas pendientes, tareas atrasadas y alertas automaticas
d) El historial clinico completo de cada residente
EXPLICACION: El dashboard global muestra en tiempo real beneficios por vencer, citas pendientes con especialistas, tareas atrasadas y alertas automaticas de todos los residentes.

P: Que incluye el perfil del residente en Zendi TS?
a) Solo datos demograficos y contacto de emergencia
b) Historial medico completo y recetas activas
*c) Historial social, contactos familiares, beneficios activos, necesidades especiales y notas clinicas relevantes
d) Solo la informacion necesaria para facturacion
EXPLICACION: El perfil incluye historial social, contactos familiares, beneficios activos, necesidades especiales y notas clinicas relevantes para una vision completa del residente.

P: Cual es el proposito principal del dashboard global?
a) Generar reportes mensuales para la administracion
b) Mostrar metricas de desempeno del trabajador social
*c) Permitir que el trabajador social priorice su dia con un solo vistazo
d) Facilitar la comunicacion con las familias de los residentes
EXPLICACION: El dashboard esta disenado para que el trabajador social pueda ver el estado de todos sus casos y priorizar su dia rapidamente.

P: Cual es la relacion de Zendi TS con el juicio profesional del trabajador social?
a) Zendi TS toma decisiones automaticas que el trabajador social ejecuta
b) Zendi TS reemplaza la necesidad de juicio profesional
*c) Zendi TS no reemplaza el juicio profesional, pero provee herramientas para que nada critico se pierda
d) Zendi TS solo se usa cuando el trabajador social necesita orientacion
EXPLICACION: Zendi TS es una herramienta de apoyo que no sustituye el juicio profesional, sino que asegura que ninguna tarea critica se pierda en la complejidad del trabajo diario.

---SECCION_2---
LECTURA:
# Dashboard Global y Perfil del Residente

El dashboard global de Zendi TS organiza la informacion en cuatro paneles: Alertas Activas, Beneficios por Vencer, Tareas Pendientes y Calendario de Citas. Las Alertas Activas muestran situaciones que requieren atencion inmediata, como un residente sin contacto familiar registrado o un beneficio que vence en menos de 7 dias. Los Beneficios por Vencer listan todos los planes medicos, seguros suplementarios y beneficios gubernamentales de los residentes con su fecha de vencimiento. Las Tareas Pendientes muestran las acciones que el trabajador social debe completar, priorizadas por urgencia. El Calendario de Citas muestra las citas programadas con especialistas, agencias y familiares. Al hacer clic en cualquier residente, se abre su perfil completo. El perfil esta organizado en pestanas: Datos Personales, Historial Social, Beneficios, Especialistas, Expediente y Notas. Cada pestana contiene informacion especifica y puede ser actualizada en tiempo real. El perfil del residente es el documento vivo mas importante del trabajador social y debe mantenerse actualizado constantemente.

PREGUNTAS:
P: Cuales son los cuatro paneles del dashboard global de Zendi TS?
a) Residentes, Familias, Documentos y Reportes
*b) Alertas Activas, Beneficios por Vencer, Tareas Pendientes y Calendario de Citas
c) Casos Abiertos, Casos Cerrados, Seguimiento y Archivos
d) Urgentes, Importantes, Normales y Completados
EXPLICACION: El dashboard se organiza en cuatro paneles: Alertas Activas, Beneficios por Vencer, Tareas Pendientes y Calendario de Citas.

P: Que tipo de situacion genera una Alerta Activa en el dashboard?
a) Cuando un residente cumple anos en los proximos 7 dias
*b) Un residente sin contacto familiar registrado o un beneficio que vence en menos de 7 dias
c) Cuando el trabajador social tiene mas de 5 tareas pendientes
d) Cuando un especialista cancela una cita programada
EXPLICACION: Las Alertas Activas se generan por situaciones criticas como residentes sin contacto familiar o beneficios que vencen en menos de 7 dias.

P: En que pestanas esta organizado el perfil del residente?
a) General, Medico, Legal y Financiero
b) Basico, Avanzado y Archivos
*c) Datos Personales, Historial Social, Beneficios, Especialistas, Expediente y Notas
d) Contacto, Salud, Documentos y Comunicaciones
EXPLICACION: El perfil se organiza en seis pestanas: Datos Personales, Historial Social, Beneficios, Especialistas, Expediente y Notas.

P: Por que se describe el perfil del residente como un documento vivo?
a) Porque se genera automaticamente cada dia
b) Porque solo el sistema puede modificarlo
*c) Porque debe mantenerse actualizado constantemente con nueva informacion
d) Porque los familiares pueden editarlo remotamente
EXPLICACION: El perfil del residente es un documento vivo porque requiere actualizacion constante por parte del trabajador social a medida que cambia la situacion del residente.

P: Que muestra el panel de Calendario de Citas?
a) Solo las citas medicas del residente
b) El horario de trabajo del trabajador social
*c) Citas programadas con especialistas, agencias y familiares
d) Las fechas de renovacion de todos los beneficios
EXPLICACION: El Calendario de Citas muestra todas las citas programadas con especialistas medicos, agencias gubernamentales y familiares de los residentes.

---SECCION_3---
LECTURA:
# Beneficios y Alertas Automaticas

La gestion de beneficios es una de las funciones mas criticas del trabajador social en un hogar de cuido. Los residentes dependen de multiples beneficios: plan medico (Medicare, Medicaid, planes comerciales), seguro suplementario, beneficios de farmacia, programas de asistencia alimentaria y servicios de salud mental. Zendi TS registra cada beneficio con su tipo, proveedor, numero de poliza, fecha de inicio y fecha de vencimiento. El sistema genera alertas automaticas en tres niveles: 30 dias antes del vencimiento (alerta amarilla), 15 dias antes (alerta naranja) y 7 dias antes (alerta roja). Si un beneficio vence sin accion, Zendity marca el caso como critico y notifica al Director. Las alertas no solo aparecen en el dashboard del trabajador social, sino que tambien generan tareas automaticas en la lista de pendientes con los pasos necesarios para la renovacion. Cada accion tomada sobre un beneficio debe documentarse en el expediente del residente: llamadas realizadas, documentos enviados, respuestas recibidas y fechas clave. Esta documentacion es esencial para auditorias y para proteger los derechos del residente.

PREGUNTAS:
P: Que tipos de beneficios gestiona el trabajador social a traves de Zendi TS?
a) Solo planes medicos y seguros
b) Unicamente beneficios gubernamentales
*c) Plan medico, seguro suplementario, farmacia, asistencia alimentaria y salud mental
d) Solo Medicare y Medicaid
EXPLICACION: Zendi TS gestiona multiples beneficios incluyendo planes medicos, seguros suplementarios, farmacia, asistencia alimentaria y servicios de salud mental.

P: A cuantos dias del vencimiento se genera la alerta roja en Zendi TS?
a) 3 dias
*b) 7 dias
c) 14 dias
d) 30 dias
EXPLICACION: La alerta roja se genera 7 dias antes del vencimiento, siendo el nivel mas urgente del sistema de alertas de beneficios.

P: Que sucede si un beneficio vence sin que se haya tomado accion?
a) Se renueva automaticamente por 30 dias
b) Se archiva en el historial sin mas accion
*c) Zendity marca el caso como critico y notifica al Director
d) Se envia una carta automatica al proveedor del beneficio
EXPLICACION: Si un beneficio vence sin accion, el caso se marca como critico y el Director recibe una notificacion, escalando la situacion al nivel mas alto.

P: Que genera automaticamente Zendi TS cuando emite una alerta de beneficio por vencer?
a) Una carta de renovacion al proveedor
b) Un correo electronico al familiar responsable
*c) Tareas automaticas en la lista de pendientes con los pasos necesarios para la renovacion
d) Una solicitud de cotizacion al nuevo proveedor
EXPLICACION: Ademas de la alerta, Zendi TS genera tareas automaticas en la lista de pendientes del trabajador social con los pasos especificos para gestionar la renovacion.

P: Que informacion debe documentarse en el expediente al gestionar un beneficio?
a) Solo la fecha de renovacion exitosa
b) El nombre del agente que proceso la renovacion
*c) Llamadas realizadas, documentos enviados, respuestas recibidas y fechas clave
d) Solo si la renovacion fue aprobada o denegada
EXPLICACION: Cada accion sobre un beneficio debe documentarse completamente: llamadas, documentos, respuestas y fechas, tanto para auditorias como para proteger los derechos del residente.

---SECCION_4---
LECTURA:
# Coordinacion de Especialistas

Los residentes de un hogar de cuido frecuentemente requieren atencion de multiples especialistas medicos: cardiologo, neurologo, psiquiatra, fisiatra, dermatologo, entre otros. Zendi TS centraliza la coordinacion de todos estos servicios. Para cada residente, el trabajador social puede registrar sus especialistas activos, la frecuencia de visitas recomendada, la ultima cita, la proxima cita y notas de seguimiento. El sistema genera recordatorios automaticos cuando se acerca una cita programada y alertas cuando un residente lleva mas tiempo del recomendado sin ver a un especialista. La coordinacion incluye gestionar el transporte del residente a la cita, confirmar la cita con el consultorio del especialista, preparar documentos medicos necesarios y coordinar con el cuidador asignado. Despues de cada cita, el trabajador social debe documentar en Zendity el resultado de la visita, las recomendaciones del especialista y las acciones de seguimiento. Zendi TS permite ver el historial completo de citas de un residente con todos sus especialistas, facilitando la deteccion de patrones y asegurando continuidad en el cuidado.

PREGUNTAS:
P: Que informacion registra Zendi TS para cada especialista de un residente?
a) Solo el nombre del especialista y telefono del consultorio
*b) Especialistas activos, frecuencia de visitas, ultima cita, proxima cita y notas de seguimiento
c) Solo las recetas y tratamientos indicados
d) El costo de cada visita y el seguro que la cubre
EXPLICACION: Zendi TS registra especialistas activos, frecuencia de visitas recomendada, ultima cita, proxima cita y notas de seguimiento para cada residente.

P: Que alerta genera Zendi TS sobre la frecuencia de visitas a especialistas?
a) Solo cuando una cita es cancelada por el especialista
b) Cuando el residente rechaza ir a una cita
*c) Cuando un residente lleva mas tiempo del recomendado sin ver a un especialista
d) Solo al inicio de cada mes con un resumen de citas pendientes
EXPLICACION: El sistema genera alertas cuando detecta que un residente ha excedido el tiempo recomendado entre visitas a un especialista.

P: Que tareas incluye la coordinacion de una cita con especialista?
a) Solo confirmar la cita con el consultorio
b) Solo gestionar el transporte del residente
*c) Gestionar transporte, confirmar cita, preparar documentos medicos y coordinar con el cuidador
d) Solo notificar al residente y su familiar
EXPLICACION: La coordinacion completa incluye transporte, confirmacion de cita, preparacion de documentos medicos y coordinacion con el cuidador asignado.

P: Que debe documentar el trabajador social despues de cada cita con un especialista?
a) Solo si el residente asistio o no
b) El costo de la visita y el copago
*c) Resultado de la visita, recomendaciones del especialista y acciones de seguimiento
d) Solo las recetas nuevas del especialista
EXPLICACION: Despues de cada cita se debe documentar el resultado de la visita, las recomendaciones medicas y las acciones de seguimiento necesarias.

P: Para que sirve el historial completo de citas de un residente en Zendi TS?
a) Para calcular los costos medicos anuales del residente
b) Solo para cumplir con requisitos de auditoria
*c) Para detectar patrones y asegurar continuidad en el cuidado
d) Para comparar el nivel de atencion entre diferentes residentes
EXPLICACION: El historial completo permite detectar patrones en la salud del residente y asegurar que haya continuidad y coherencia en el cuidado multidisciplinario.

---SECCION_5---
LECTURA:
# Onboarding Inicial y Expediente

El onboarding inicial es el proceso de ingreso de un nuevo residente al hogar de cuido, y es una de las responsabilidades mas complejas del trabajador social. Zendi TS guia este proceso con un checklist estructurado que incluye: recopilar documentos legales (identificacion, poder notarial, directrices anticipadas), registrar contactos familiares y de emergencia, verificar y registrar todos los beneficios activos, programar evaluaciones iniciales con especialistas y crear el expediente social completo. El expediente es el documento maestro del residente en Zendi TS. Contiene toda la documentacion recopilada desde el ingreso, organizada cronologicamente y categorizada por tipo: legal, medico, social, financiero y administrativo. Zendity asigna un porcentaje de completitud al expediente y genera alertas si hay documentos faltantes o vencidos. Un expediente con menos del 80 por ciento de completitud genera una alerta diaria al trabajador social y una alerta semanal al Director. El onboarding debe completarse dentro de los primeros 10 dias habiles del ingreso del residente. Documentos vencidos o faltantes ponen en riesgo la licencia del hogar durante auditorias.

PREGUNTAS:
P: Que elementos incluye el checklist de onboarding inicial en Zendi TS?
a) Solo documentos legales y contactos de emergencia
b) Unicamente la evaluacion medica y el plan de cuidado
*c) Documentos legales, contactos, beneficios activos, evaluaciones con especialistas y expediente social completo
d) Solo la informacion necesaria para facturacion y cobro
EXPLICACION: El onboarding incluye documentos legales, contactos familiares y de emergencia, beneficios activos, evaluaciones iniciales y creacion del expediente social completo.

P: En cuantas categorias se organiza la documentacion del expediente?
a) Tres: medico, legal y social
*b) Cinco: legal, medico, social, financiero y administrativo
c) Cuatro: personal, medico, legal y familiar
d) Dos: clinico y administrativo
EXPLICACION: El expediente organiza la documentacion en cinco categorias: legal, medico, social, financiero y administrativo.

P: Que sucede cuando un expediente tiene menos del 80 por ciento de completitud?
a) Se bloquea el acceso al perfil del residente
*b) Se genera una alerta diaria al trabajador social y una semanal al Director
c) Se notifica a la agencia reguladora automaticamente
d) Se suspenden los servicios del residente hasta completar la documentacion
EXPLICACION: Un expediente por debajo del 80 por ciento genera alertas diarias al trabajador social y semanales al Director para impulsar la completacion.

P: En cuanto tiempo debe completarse el onboarding de un nuevo residente?
a) 5 dias habiles
*b) 10 dias habiles
c) 15 dias habiles
d) 30 dias calendario
EXPLICACION: El onboarding debe completarse dentro de los primeros 10 dias habiles del ingreso del residente al hogar de cuido.

P: Por que los documentos faltantes o vencidos representan un riesgo para el hogar?
a) Porque los familiares pueden presentar quejas formales
b) Porque afectan la facturacion a los planes medicos
*c) Porque ponen en riesgo la licencia del hogar durante auditorias regulatorias
d) Porque Zendity bloquea el acceso al sistema hasta que se completen
EXPLICACION: Los documentos faltantes o vencidos en los expedientes ponen en riesgo la licencia del hogar durante las auditorias de agencias reguladoras.
`
}

];

// ── Execution ──────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const HQ_ID = 'b5d13d84-0a57-42fe-a1ed-bff887ed0c09'

    for (const course of ACADEMY_SEED_COURSES) {
        await prisma.course.upsert({
            where: {
                id: course.id
            },
            update: {
                title: course.title,
                description: course.description,
                content: course.content,
                durationMins: course.durationMins,
                bonusCompliance: course.bonusCompliance,
                emoji: course.emoji,
                category: course.category || 'General',
                isGlobal: true,
            },
            create: {
                id: course.id,
                headquartersId: HQ_ID,
                title: course.title,
                description: course.description,
                content: course.content,
                durationMins: course.durationMins,
                bonusCompliance: course.bonusCompliance,
                emoji: course.emoji,
                category: course.category || 'General',
                isGlobal: true,
            }
        })
        console.log(`✓ ${course.id} → ${course.title}`)
    }
    console.log('\nSeed completo')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
