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
