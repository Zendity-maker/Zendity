# 🏥 Zendity Home System 
**Clinical Compliance & B2B/B2C Elderly Care Management**

Zendity es una suite de "Compliance as a Service" desarrollada bajo **Next.js 14**, diseñada específicamente para centralizar la operatividad clínica, legal y administrativa de residencias de ancianos de alto estándar (Elderly Homes).

El núcleo del sistema está propulsado por **Zendity AI**, una inteligencia artificial integrada por voz, procesamiento analítico (NLP) y automatizaciones cognitivas capaces de prevenir negligencias e interconectar a todo el ecosistema de la sede.

## 📖 Arquitectura y Framework Teórico
Zendity no es solo código; es metodología clínica incrustada en software. Por favor, revisa el manifiesto arquitectónico y los disparadores inteligentes (Digital Triggers) en la raíz del proyecto para comprender cómo la IA transforma los cuidados:

👉 **[Leer Manual de Protocolos de Atención: Ecosistema Zendity AI](./ZENDITY_AI_PROTOCOL_MANUAL.md)**

### Módulos Principales de la Suite
1. **Zendity Med (eMAR)**: Control estricto farmacológico B2B sin papel con validación de administraciones.
2. **Zendity CRM & Smart Receptionist**: Embudo B2B prospectivo con IA de voz Vapi y transacciones "Zero-Data-Entry".
3. **Zendity Pay**: Pasarela de pago B2C para familiares ("One-Click Pay") e Invoice Generations.
4. **Portal Familiar (HIPAA-compliant)**: Comunicación transparente, Reporte de Signos Vitales y "Zendi Life Plans" B2C.
5. **Incidents & QA**: Escalafón de riesgo dinámico (Downton, Prevención UPP) interconectado.
6. **Zendity Handovers**: Traslado de mandos clínicos inter-turno con _AI Digest_ (Generación automática de resúmenes de guardia).

## 🚀 Despliegue Técnico (Tech Stack)
- **Framework Core**: Next.js 14 (App Router) + React
- **Base de Datos & ORM**: PostgreSQL (Neon Serverless) + Prisma ORM
- **Estilos y UI**: Tailwind CSS (Vanilla No-Components)
- **Voice AI & Automations**: VAPI / Bland AI, Twilio SMS, SendGrid Emailing, Google Calendar API.

### Inicio Rápido (Local Development)

```bash
npm install
npm run dev
# Módulos Corporativos: http://localhost:3000/corporate
# Portal Familiar: http://localhost:3000/family
```
