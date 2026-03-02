---
description: Cómo configurar Vapi AI con Zendity Serverless Endpoints
---

# 🤖 Guía de Integración Vapi AI (Smart Receptionist)

Vapi es el motor telefónico que da vida a **Zendi AI**. Para que las llamadas físicas de tus clientes lleguen a los cerebros lógicos que acabamos de programar en Next.js, debes seguir estos pasos desde el panel de control de Vapi (`dashboard.vapi.ai`):

## 1. Exponer Zendity a Internet (Modo Local)
Dado que estás desarrollando en *localhost:3000*, Vapi (que está en la nube) no puede ver tu computadora. Necesitas un túnel seguro temporal:
1. Instala Ngrok u otro servicio de túnel: `npm install -g ngrok`
2. Ejecuta en una nueva terminal: `ngrok http 3000`
3. Ngrok te dará una URL pública (Ej: `https://abcd-123.ngrok.app`). Guarda esa URL, será t **URL BASE**. *(En producción, esta URL será `https://tudominio.com`).*

---

## 2. Configurar el "Server URL" (Prompt Maestro Dinámico)
Vapi necesita saber *qué decirle y cómo comportarse* justo antes de descolgar la llamada. Nosotros configuramos esto en `/api/ai/vapi-inbound/route.ts`.

1. Entra a **dashboard.vapi.ai**.
2. Ve a la sección **Assistants** y crea uno nuevo (o usa el que ya tienes).
3. Busca la pestaña o sección llamada **Advanced** o **Server Actions**.
4. En el campo **Server URL**, pega tu ruta Inbound: 
   `[TU_URL_BASE]/api/ai/vapi-inbound`
5. Activa los eventos (**Events**) que Vapi enviará a esa URL. Asegúrate de marcar mínimo:
   - `assistant-request` (Vital para que Zendi cargue tu Prompt de Vivid Cupey).
   - `end-of-call-report` (Vital para el CRM).

Con este paso, el Dashboard de Vapi será sobreescrito por el código de tu repositorio Zendity cada vez que entre una llamada.

---

## 3. Configurar la Extracción de Datos (Structured Data)
Para que Vapi le envíe a nuestro Webhook datos fáciles de insertar en la base de datos de Prisma, debes indicarle qué extraer de la conversación humana:

1. Dentro de tu Assistant en Vapi, busca la sección **Data Extraction** o **Structured Data**.
2. Añade las siguientes variables (JSON Schema) para que la IA escuche esos datos:
   - `prospectName`: (string), Descripción: "El primer y apellido que otorgue el cliente".
   - `email`: (string), Descripción: "El correo electrónico si lo proveen".
   - `didScheduleTour`: (boolean), Descripción: "Devuelve true si el cliente aceptó o sugirió un tour por las facilidades".
   - `tourDate`: (string), Descripción: "La fecha tentativa mencionada para el tour (Ej: Este Jueves)".

---

## 4. Configurar Números de Teléfono y Metadata
Para que Zendity sepa *a qué sede* B2B pertenece la llamada (y meta al prospecto en el Kanban correcto):

1. Ve a la pestaña **Phone Numbers** en Vapi y vincula tu número telefónico B2B.
2. Al vincular o editar el asistente en ese número específico, añade los **Metadata Attributes**.
3. Añade una clave `headquartersId` y pon de Valor el ID de Base de Datos UUID de tu sede de *Vivid Cupey* (Ej: `49a6a75e-93cf-42e4-aa9f-69649bcbb6c0`).

---

## ✅ Flujo Finalizado
Cuando alguien llame a tu número:
1. Vapi manda un POST a `[URL_BASE]/api/ai/vapi-inbound`.
2. Tu NextJS le devuelve el **Prompt Maestro** B2B. Zendi saluda.
3. Al colgar la llamada, Vapi manda OTRO POST a `[URL_BASE]/api/ai/vapi-inbound` (o Webhook URL) con el evento `end-of-call-report` + Transcript + Extracciones.
4. NextJS intercepta ese POST final y crea a la persona en el Kanban Drag-and-Drop de Zendity CRM.
