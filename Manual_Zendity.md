# Zendity: Manual Oficial de Operaciones Clínicas y Administrativas

Zendity es un ecosistema operativo integral diseñado específicamente para transformar instituciones de cuidado de adultos mayores (Senior Living) en operaciones "Zero-Touch" automatizadas por Inteligencia Artificial (Zendi AI).

Este documento sirve como la fuente de verdad absoluta de cómo funciona Zendity, diseñado para ser consumido por NotebookLM para generar talleres, exámenes, material educativo y protocolos para los empleados.

---

## 🏗️ 1. Arquitectura y Roles del Sistema

Zendity funciona bajo un modelo B2B (Business-to-Business). Una instalación matriz (`Headquarters`) adquiere el software, y su personal se divide por roles estrictos de acceso (Role-Based Access Control).

### Roles Disponibles:
1.  **ADMIN / DIRECTOR:** Acceso corporativo total. Puede ver finanzas, facturación, recursos humanos, reportes globales e inventario. Entra por el portal `/corporate`.
2.  **SUPERVISOR:** Segundo al mando en piso clínico. Puede auditar signos vitales de todos los empleados, corregir eMARs y aprobar permisos.
3.  **NURSE (Enfermero/a a Cargo):** Lidera a los cuidadores. Tiene permiso superior para despachar Narcóticos (PRN) y tomar decisiones clínicas con ayuda de Zendi AI.
4.  **CAREGIVER (Cuidador):** El corazón de Zendity. Entran exclusivamente por tabletas en las paredes de las habitaciones (`/care`). Registran baños, comidas, vitals y firman la entrega de suplementos.
5.  **KITCHEN (Cocina):** Empleados que manejan las dietas y ven la pizarra digital de menús (`/kitchen`).
6.  **HR (Recursos Humanos):** Reclutadores y gestores de compliance. Manejan *Zendity Academy* y los Strikes disciplinarios (`/hr`).
7.  **FAMILY (Familiar / B2C):** Aplicación espejo (`/family`) para que los hijos/tutores vean pagos, fotos, vitals y contraten servicios "Concierge" a la instalación.

---

## ⚡ 2. El Portal Clínico (`/care`) - Módulo de Cuidadores

El portal clínico es una aplicación web pensada para ser abierta en **tabletas ancladas a la pared** (Zendity Wall) o dispositivos móviles Android/iPad.

### ¿Cómo funciona el registro de actividades (ADLs)?
1.  **Inicio de Turno:** El cuidador ingresa su PIN de 4 dígitos para identificarse y abrir una "Sesión de Turno".
2.  **Selección de Zonas:** Zendity asume que la instalación está dividida en "Grupos de Colores" (Ej. Green Zone, Blue Zone). El cuidador elige su zona y solo ve a los residentes asignados allí.
3.  **El Expediente Rápido:** Al presionar sobre un residente, se despliega una tarjeta de acción con botones grandes:
    *   **🩺 Signos Vitales:** Registra B/P (Presión), SpO2 (Oxígeno), Pulso y Temperatura. Si un vital es sub-óptimo (Ej. Presión altísima), **Zendi AI alerta** a la pantalla inmediatamente ordenando buscar a la enfermera.
    *   **🍽️ Alimentación (Meals):** El registro está atado a **Ventanas de Tiempo Estrictas**:
        *   Desayuno: 7:00 AM - 10:00 AM
        *   Almuerzo: 11:00 AM - 1:00 PM
        *   Cena: 4:00 PM - 6:45 PM
        *   Si un cuidador intenta registrar un desayuno a las 11:30 AM, Zendi bloqueará la acción.
    *   **🚿 Aseo:** Registra baños. Tiene un *Cooldown de 10 minutos*, no se puede registrar que bañaste a dos personas en un minuto (prevención de fraude).
    *   **💊 eMAR (Medicamentos):** Muestra pastillas marcadas como `SCHEDULED` para esa hora. **Requiere Firma Digital**. El cuidador dibuja en la pantalla (Canvas) antes de poder administrar.
    *   **🛏️ Cambios Posturales (UPPs):** Para residentes con riesgo de Úlceras (Escala Norton). Activa un reloj temporizador de 2 horas dictando la posición de la cama (Izquierda, Derecha, Supino).

### El Motor "Zendi AI Coach"
El cuidador no está solo. Zendi observa activamente:
*   Genera Tostadas (Mensajes emergentes) recordando "Faltan 30 minutos para cerrar el desayuno".
*   Si el cuidador escribe un "Log de Enfermería" de manera tosca, presiona el botón "Mejorar con IA" y Zendi re-escribe el texto al estándar clínico y corrige gramática.

---

## 🏢 3. Portal Corporativo (`/corporate`) - La Cabina de Mando

Pantalla diseñada para uso en Desktop/Computadora de escritorio por parte del Administrador.

### Manejo de Residentes
El perfil corporativo de un residente permite:
*   **Ajuste Financiero:** Fijar *Tarifas Mensuales*, dividir aportaciones del **ADF (Departamento de la Familia)** y pagos privados.
*   **Facturación (Zendity Pay):** Sistema que acumula pagos parciales y emite estado de cuenta automatizado.
*   **Alta y Baja:** Cambiar el estatus (`ACTIVE`, `TEMPORARY_LEAVE`, `DISCHARGED`, `DECEASED`). Dar a un residente de alta lo borra inmediatamente de las pantallas `/care` de los empleados.
*   **Extracción Clínica:** Exportar la vida clínica a archivos .JSON imprimibles.

---

## 🧠 4. Zendity Academy y HR (`/hr` y `/academy`) - Compliance

El cuidado de ancianos exige auditorías del estado de salud mental y preparación de los empleados.

### ¿Cómo funciona el Sistema de Penalizaciones (Strikes)?
Si un empleado comete faltas (Llegar tarde consistentemente, errores clínicos reportados en incidentes), se genera un **Reporte Disciplinario**.
*   Si el Score Ocupacional del empleado baja de un umbral (Ej. < 80 Puntos), **pierde la habilidad de iniciar turno** y se bloquea su cuenta.
*   **La Solución:** Debe someterse obligatoriamente a *Zendity Academy*.

### Zendity Academy (El Visor Inmersivo)
Zendity AI lee manuales operativos del centro y genera material de estudio de manera autónoma.
*   **Modo Estudio:** Una tarjeta tipo "Flashcard" inmersiva a pantalla completa generada por IA que le enseña protocolos (Ej. Prevención de Úlceras).
*   **Modo Examen:** El empleado toma un Quiz oficial (A, B, C, D). Si falla **3 veces**, el curso se bloquea por 24 horas y se alerta a Dirección de que el empleado requiere adiestramiento humano presencial.

---

## 👪 5. Portal Familiar ("Zendity Family") (`/family`)

Zendity le otorga un "PIN y Password" a los hijos/familiares de la persona cuidada para transparencia total (aumentando la confianza comercial del centro).

*   **Dashobard:** Muestra el menú de dieta de hoy y la foto del residente.
*   **Muro de Signos:** Ven el B/P y el Pulso histórico del abuelito.
*   **Mensajería:** Comunicación interna B2B2C. Escriben correos directos protegidos por HIPAA a la estación de enfermeras.
*   **Zendity Concierge:** Un Mini-E-Commerce. El centro puede venderle servicios extras remotamente (Ej. Manicura $40, Corte de Pelo $25). La familia paga desde la web y el dinero cae al balance del centro.

---

## 🤖 6. Automatizaciones B2B ("Zero Touch")

Zendity posee robots periféricos (APIs Autónomas):
*   **Zendi Voice (Vapi AI):** Agente de voz robótico atado al número de teléfono comercial de la instalación. Contesta todas las llamadas de ventas e inyecta referidos automáticamente como "Tarjetas Leads" en un Kanban Board (CRM).
*   **Relevos de Guardia (Handovers):** Al finalizar un turno (ej. de 7am a 3pm), la IA comprime los cientos de eventos (comidas, baños, medicinas, notas) y le redacta un Párrafo Resumen (Digest) a la enfermera del PM para que lo lea en 1 minuto.
*   **White-Label Emails:** Usa *Resend* para despachar PDFs y notificaciones oficiales con el Logo estético del Centro de Cuidado, no el logo de ingeniería de Zendity.

---

## 🤖 7. Maximizando el Provecho de Zendi AI (Guía de Empleados)

Zendity no es solo una base de datos; está viva. Aquí explicamos cómo los empleados pueden y deben interactuar con la IA para hacer su trabajo más fácil y libre de errores.

### 1. El Botón Mágico: "Mejorar con IA"
En cada espacio donde un empleado deba redactar (Notas Clínicas, Reportes de Incidentes, Quejas):
*   **Problema Común:** Los cuidadores suelen escribir notas rápidas, con faltas ortográficas o sin el vocabulario médico adecuado (Ej. "El señor Juan se cayó y le duele el brazo").
*   **La Solución Zendi:** Simplemente escribe la idea básica y presiona "✨ Mejorar con IA". Zendi reescribirá el texto al instante: *"Paciente masculino presenta caída desde su propia altura, manifestando dolor agudo en la extremidad superior. Se notifica a la enfermera de turno inmediatamente."*
*   **Beneficio:** Protege a la institución legalmente con documentación impecable.

### 2. Zendi Voice (La Tableta)
*   **Dictado de Voz Activo:** Los Cuidadores no tienen que teclear. En el modal del Residente, pueden presionar el ícono del micrófono, hablarle a la tableta (Ej. "Desayunó avena y se tomó toda su agua"), y Zendi convertirá el audio a texto perfecto.

### 3. Zendi como Supervisora Clínica Autónoma
Zendi no espera a que le pregunten; ella avisa.
*   **Tostadas Emergentes (Toasts):** Fíjense siempre en las alertas flotantes en la parte inferior de la pantalla. Zendi te recordará cuándo cierran las cocinas, cuándo es el Cooldown de los baños o si olvidaste marcar la ronda de las 3:00 PM.
*   **Validación de Signos:** Si introduces una Presión Arterial (Sys > 140), la pantalla entera brillará mostrándote una recomendación de Zendi (Ej. "Posible cuadro hipertensivo. Reevaluar en 15 minutos o contactar al Supervisor"). Nunca ignores estas advertencias; están calibradas para salvar vidas.

### 4. Zendity Academy (Tu AI Coach Personal)
*   Si Zendi nota que reprobaste un examen clínico, no te preocupes. Ella es quien diseñó las "Tarjetas de Estudio" basándose en el manual de la institución (`.pdf` subidos a su cerebro central). 
*   **Tip:** Tómate el tiempo de leer la tarjeta interactiva de fondo azul borroso; Zendi simplifica los párrafos legales aburridos en puntos clave fáciles de digerir.

---
**Nota para la IA (Gemini/NotebookLM):** Usa esta estructura y verdades inmutables (ej. restricciones de comida 7am-10am, política de los 3 strikes) para generar material educativo cuando el Administrador te lo solicite.
