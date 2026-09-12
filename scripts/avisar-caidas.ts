/**
 * AVISA AL PISO DEL CURSO DE CAÍDAS, CON LO QUE HA PASADO DE VERDAD.
 *
 * El curso "Protocolo de Respuesta a Caídas" quedó asignado el 12-sep-2026 a las
 * 14 personas que pisan el piso en Cupey. El backfill no notificó a nadie a
 * propósito —catorce avisos idénticos el mismo minuto son ruido— y este script
 * es la otra mitad: el aviso que sí explica por qué.
 *
 * LOS NÚMEROS NO SE ESCRIBEN A MANO. Se cuentan de FallIncident cada vez que se
 * corre, así que el correo dice lo que pasa hoy y no lo que pasaba el día que
 * alguien redactó la plantilla.
 *
 * SIN PHI — regla 7 de CLAUDE.md. Ni un nombre de residente, ni una habitación,
 * ni un diagnóstico, ni una fecha, ni una franja horaria: solo cuántas. El script
 * ABORTA si detecta el nombre de un residente en el cuerpo, y al abortar NO
 * imprime cuál encontró.
 *
 * NO SE HABLA DE GRAVEDAD, y es deliberado. `deriveSeverity` la calcula SOLO con
 * el deslizador de dolor: una caída con sangrado y dolor 4 queda "Leve". Además,
 * una de las tres "graves" de Cupey la escribió /api/care/hospitalize con
 * severity SEVERE constante y sin ningún dato clínico — es la caída de un
 * residente que falleció. Contarla al piso como "grave con sangrado o dolor
 * fuerte" habría sido falso dos veces.
 *
 * LA CAÍDA DUPLICADA SE CUENTA UNA VEZ. El 30-ago-2026 quedaron dos registros
 * del mismo suceso —mismo residente, mismo minuto, misma gravedad—, que es el
 * anti-patrón 1 de CLAUDE.md. Decir "8 caídas" sería contar una que no pasó.
 *
 *   npx tsx scripts/avisar-caidas.ts                       simula y escribe el HTML en /tmp
 *   npx tsx scripts/avisar-caidas.ts --prueba=tu@correo    una sola copia, para verla llegar
 *   npx tsx scripts/avisar-caidas.ts --confirmar           manda a las 14
 *   npx tsx scripts/avisar-caidas.ts --solo-app            solo la campana, sin correo
 */
import { config as cargarEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import { writeFileSync } from 'fs';

/**
 * LA CLAVE DE SENDGRID VIVE EN .env.local, Y tsx SOLO CARGA .env.
 *
 * Sin esta linea, `--confirmar` escribia las 14 notificaciones en PRODUCCION,
 * imprimia catorce veces "(solo app)" y cerraba con "correos enviados: 0" — con
 * toda la pinta de haber funcionado. Es el patron "promete y no entrega", y
 * estaba dentro del script que existe precisamente para avisar a la gente.
 *
 * `override: false`: si alguien pasa la variable por delante en el comando, esa
 * manda.
 */
cargarEnv({ path: '.env.local', override: false, quiet: true });

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--confirmar');
const SOLO_APP = process.argv.includes('--solo-app');
/**
 * `--prueba=correo@dominio` manda UNA sola copia a esa direccion y para.
 *
 * Existe porque no hay forma honesta de saber como llega un correo mirandolo en
 * el navegador: el cliente de correo se come estilos, cambia anchos y decide por
 * su cuenta si carga las fuentes. Verlo en el telefono es la unica prueba.
 *
 * No escribe nada en la base y no toca a nadie del piso.
 */
const PRUEBA = (process.argv.find(a => a.startsWith('--prueba=')) ?? '').split('=')[1] ?? '';
const CURSO = 'Protocolo de Respuesta a Caidas';
const DIAS = 90;

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

interface Cifras {
    enElModulo: number;
    enBitacoraSinFicha: number;
    total: number;
    ultimos30Modulo: number;
    duplicadasDescartadas: number;
}

/**
 * FRASES DE BITACORA QUE DESCRIBEN UNA CAIDA QUE YA OCURRIO.
 *
 * "riesgo de caida" y "para evitar caidas" NO son caidas: son prevencion. El
 * primer intento las contaba y el numero salia inflado, que es el error
 * simetrico del que se viene a corregir.
 */
const HABLA_DE_UNA_CAIDA = /(sufri[oó]\s+(una\s+)?ca[ií]da|sufri[oó]\s+dos\s+ca[ií]das|tuvo\s+una\s+ca[ií]da|se\s+cay[oó]|se\s+call?[oó]|se\s+resbal[oó]|^\s*\[?[^\]]*\]?\s*ca[ií]da\b)/i;
const ES_PREVENCION = /riesgo de ca[ií]da|evitar ca[ií]das|para evitar/i;

async function contar(hqId: string): Promise<Cifras> {
    const desde = new Date(Date.now() - DIAS * 86400000);
    const todas = await prisma.fallIncident.findMany({
        where: { patient: { headquartersId: hqId }, incidentDate: { gte: desde } },
        select: { patientId: true, incidentDate: true, severity: true },
        orderBy: { incidentDate: 'asc' },
    });

    /**
     * Deduplicado por (residente, minuto).
     *
     * Dos filas del mismo residente en el mismo minuto son el mismo suceso
     * escrito dos veces, no dos caidas. Ver el anti-patron 1 de CLAUDE.md: el
     * POST de incidentes no tenia guarda contra el doble toque cuando se
     * registraron estas.
     */
    const vistas = new Set<string>();
    const modulo = todas.filter(x => {
        const k = `${x.patientId}::${x.incidentDate.toISOString().slice(0, 16)}`;
        if (vistas.has(k)) return false;
        vistas.add(k);
        return true;
    });

    /**
     * LO QUE EL MODULO NO VE.
     *
     * Medido el 12-sep-2026: el modulo tenia 7 caidas en 90 dias y el piso
     * habia escrito OCHO mas en la bitacora que nunca llegaron a el. Decir la
     * cifra del modulo como si fuera el retrato de lo que pasa es mentirle
     * justo a quien escribio las que faltan. Ya estaba advertido desde el
     * 01-sep — ver la memoria "caidas-fuera-del-modulo".
     */
    const conFicha = new Set(modulo.map(x => `${x.patientId}::${x.incidentDate.toISOString().slice(0, 10)}`));
    const logs = await prisma.dailyLog.findMany({
        where: {
            patient: { headquartersId: hqId },
            createdAt: { gte: desde },
            OR: [
                { notes: { contains: 'caí', mode: 'insensitive' } },
                { notes: { contains: 'cay', mode: 'insensitive' } },
                { notes: { contains: 'call', mode: 'insensitive' } },
                { notes: { contains: 'resbal', mode: 'insensitive' } },
            ],
        },
        select: { createdAt: true, patientId: true, notes: true },
        orderBy: { createdAt: 'asc' },
    });

    const yaContadas = new Set<string>();
    let sinFicha = 0;
    for (const l of logs) {
        const n = l.notes ?? '';
        if (!HABLA_DE_UNA_CAIDA.test(n) || ES_PREVENCION.test(n)) continue;
        const dia = `${l.patientId}::${l.createdAt.toISOString().slice(0, 10)}`;
        if (conFicha.has(dia)) continue;      // el modulo ya la tiene
        if (yaContadas.has(dia)) continue;    // dos notas del mismo suceso
        yaContadas.add(dia);
        // "sufrió dos caídas durante la noche" son dos, no una.
        sinFicha += /\bdos\s+ca[ií]das\b/i.test(n) ? 2 : 1;
    }

    const hace30 = new Date(Date.now() - 30 * 86400000);
    return {
        enElModulo: modulo.length,
        enBitacoraSinFicha: sinFicha,
        total: modulo.length + sinFicha,
        ultimos30Modulo: modulo.filter(x => x.incidentDate >= hace30).length,
        duplicadasDescartadas: todas.length - modulo.length,
    };
}

function frase(n: Cifras): string {
    return `En los últimos ${DIAS} días el piso dejó escritas <strong>al menos ${n.total} caídas</strong>. `
        + `De esas, <strong>${n.enElModulo}</strong> entraron por el botón de la tableta; `
        + `las otras <strong>${n.enBitacoraSinFicha}</strong> quedaron contadas en una nota de turno o en una alerta.`;
}

/**
 * `nombre = null` da la version GENERAL, sin personalizar.
 *
 * El script manda uno a uno y saluda por el nombre, que es lo que se lee mejor.
 * Pero Andres lo manda a mano en copia oculta a las 14, y ahi un "Hola Herminia"
 * delante de trece personas mas es peor que no saludar a nadie.
 */
function correo(nombre: string | null, n: Cifras, minutos: number) {
    /**
     * DOS VERSIONES DEL MISMO TEXTO, Y LA CONCORDANCIA IMPORTA.
     *
     * El script manda uno a uno y saluda por el nombre. Pero cuando se manda a
     * mano en copia oculta a las catorce, "Hola Herminia" delante de trece
     * personas mas es peor que no saludar a nadie.
     *
     * Y no basta con cambiar el saludo: el primer intento decia "Hola a todos" y
     * seguia con "TIENES asignado". Un correo que no concuerda consigo mismo se
     * lee como una plantilla, y una plantilla no la contesta nadie. Por eso el
     * texto se conjuga entero, en ustedes — que es como se habla aqui.
     */
    const uno = nombre !== null;
    const v = uno ? {
        saludo: `Hola ${nombre},`, saludoHtml: `Hola <strong>${nombre}</strong>,`,
        tienes: 'Tienes', te: 'Te', puedes: 'puedes', tu: 'tu', entra: 'Entra',
        busca: 'busca', viste: 'no la viste y te la contaron',
    } : {
        saludo: 'Hola a todos,', saludoHtml: 'Hola a todos,',
        tienes: 'Tienen', te: 'Les', puedes: 'pueden', tu: 'su', entra: 'Entren',
        busca: 'busquen', viste: 'no la vieron y se la contaron',
    };

    const texto =
        `${v.saludo}\n\n` +
        `${v.tienes} asignado en Academy el curso "Protocolo de Respuesta a Caidas". ${v.te} contamos por que.\n\n` +
        `En los ultimos ${DIAS} dias el piso dejo escritas al menos ${n.total} caidas. De esas, ${n.enElModulo} entraron por el boton de la tableta; las otras ${n.enBitacoraSinFicha} quedaron contadas en una nota de turno o en una alerta.\n\n` +
        `Las notas estan bien escritas — por eso sabemos que pasaron. Lo que cambia es que el boton hace cosas que una nota no hace: avisa en el momento a supervision, a enfermeria y a direccion, y enciende la evaluacion de riesgo de ese residente para que se revise su plan.\n\n` +
        `El curso son unos ${minutos} minutos y lo ${v.puedes} hacer desde ${v.tu} telefono: ${v.entra.toLowerCase()} a app.zendity.com con ${v.tu} correo y ${v.tu} PIN, y ${v.busca} Academy.\n\n` +
        `Ensena donde esta el boton, que pregunta, que hacer cuando ${v.viste}, y a quien hay que llamar a mano porque el sistema no lo hace solo.\n\n` +
        `Gracias por lo que escriben cada turno. Sin eso no sabriamos nada de esto.\n\n— Direccion, Vivid Senior Living`;

    return {
        subject: uno ? 'El curso de caídas, y por qué te lo asignamos'
                     : 'El curso de caídas, y por qué se lo asignamos',
        text: texto,
        html: `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <div style="background:#0F6E56;padding:24px 32px;">
      <div style="color:#fff;font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;opacity:.85;">Academy · Zéndity</div>
      <div style="color:#fff;font-size:20px;font-weight:900;margin-top:4px;line-height:1.3;">El curso de caídas, y por qué ${uno ? 'te' : 'se'} lo asignamos</div>
    </div>

    <div style="padding:32px;">
      <p style="margin:0 0 18px;font-size:15px;color:#0F172A;">${v.saludoHtml}</p>

      <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#334155;">
        ${v.tienes} asignado en <strong>Academy</strong> el curso
        <strong>Protocolo de Respuesta a Caídas</strong>. ${v.te} contamos por qué.
      </p>

      <!-- Neutro a proposito: ni caja de alarma ni rojo. Es un dato, no una
           acusacion, y el color decide como se lee antes que las palabras. -->
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px 20px;margin-bottom:22px;">
        <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">${frase(n)}</p>
      </div>

      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#334155;">
        <strong>Las notas están bien escritas</strong> — por eso sabemos que pasaron.
        Lo que cambia es que el botón hace cosas que una nota no hace: avisa en el
        momento a supervisión, a enfermería y a dirección, y enciende la evaluación
        de riesgo de ese residente para que se revise su plan.
      </p>

      <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#334155;">
        El curso enseña, con fotos de la pantalla:
      </p>
      <ul style="margin:0 0 22px;padding-left:20px;font-size:15px;line-height:1.75;color:#334155;">
        <li>dónde está el botón <strong>Alerta Caída</strong> y qué abre;</li>
        <li>qué pregunta, y por qué la barrita del dolor decide cómo queda la caída en el expediente;</li>
        <li>qué marcar cuando <strong>${uno ? 'no la viste' : 'no la vieron'}</strong> y ${uno ? 'te' : 'se'} la contaron;</li>
        <li>a quién hay que llamar <strong>a mano</strong>, porque el sistema no lo hace solo.</li>
      </ul>

      <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#334155;">
        Son unos <strong>${minutos} minutos</strong> y <strong>lo ${v.puedes} hacer desde ${v.tu} teléfono</strong>.
        ${v.entra} a app.zendity.com con ${v.tu} correo y ${v.tu} PIN, y ${v.busca} <strong>Academy</strong>.
      </p>

      <div style="text-align:center;margin:8px 0 24px;">
        <a href="https://app.zendity.com/academy" style="background:#0F6E56;color:#fff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          Abrir Academy
        </a>
      </div>

      <p style="margin:0;padding-top:18px;border-top:1px solid #E2E8F0;font-size:15px;line-height:1.65;color:#334155;">
        Gracias por lo que escriben cada turno. Sin eso no sabríamos nada de esto.
      </p>
      <p style="margin:14px 0 0;font-size:15px;color:#0F172A;">— Dirección, Vivid Senior Living</p>
    </div>

    <div style="background:#F8FAFC;padding:14px 32px;border-top:1px solid #E2E8F0;text-align:center;">
      <p style="margin:0;color:#94A3B8;font-size:11px;">Vivid Senior Living · Zéndity</p>
    </div>
  </div>
</body></html>`,
    };
}

/**
 * NINGÚN NOMBRE DE RESIDENTE EN EL CUERPO.
 *
 * Se comprueba contra la lista real de residentes de la sede, no contra una
 * heurística: es la misma comprobación que hace el previsualizador del reporte
 * semanal. Si aparece uno, se aborta sin mandar nada.
 */
async function sinPHI(hqId: string, cuerpo: string, nombreDestinataria = ''): Promise<string[]> {
    const residentes = await prisma.patient.findMany({
        where: { headquartersId: hqId },
        select: { name: true },
    });
    /**
     * EL NOMBRE DE LA DESTINATARIA NO ES PHI, Y COLISIONA.
     *
     * Medido: OCHO de los 21 empleados de Cupey comparten un apellido con algún
     * residente —Santiago, Torres, Figueroa, González, Rivera, Maldonado…—. Sin
     * quitarlo, la guarda marcaba como fuga el saludo del propio correo y
     * abortaba un envío perfectamente limpio. Un guardián que grita siempre se
     * acaba apagando, y entonces no guarda nada.
     */
    let texto = cuerpo;
    for (const parte of nombreDestinataria.split(/\s+/).filter(Boolean)) {
        texto = texto.replaceAll(parte, '«destinataria»');
    }

    /**
     * PALABRAS COMPLETAS, NO SUBCADENAS.
     *
     * Con `includes` la guarda abortaba un correo limpio porque una residente
     * se llama Eva y el cuerpo dice "evaluación". Un guardián que grita en falso
     * se acaba apagando, y entonces no guarda nada.
     *
     * Se comparan palabras con límite a los lados y sin acentos, que es como se
     * escribe un nombre cuando alguien lo teclea con prisa.
     */
    const sinTildes = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const palabras = new Set(sinTildes(texto).match(/[a-z]+/g) ?? []);

    return residentes
        .flatMap(r => (r.name ?? '').split(/\s+/))
        .map(x => x.replace(/[.,]/g, ''))
        // 3 letras, no 4: en Cupey hay residentes cuyo nombre de pila es "Eva" o "Luz".
        .filter(x => x.length >= 3)
        .filter(x => palabras.has(sinTildes(x)));
}

/**
 * ¿LA CLAVE SIRVE? No basta con que exista.
 *
 * El 12-sep-2026 la guarda comprobaba `if (process.env.SENDGRID_API_KEY)` y la
 * clave estaba ahí — pero revocada. El script escribió las 14 notificaciones en
 * PRODUCCIÓN y las 14 personas se quedaron con la campana encendida y sin
 * correo. Exactamente el aviso a medias que la guarda existía para evitar.
 *
 * `/v3/scopes` es un GET: pregunta qué permisos tiene la clave y no manda nada.
 */
async function laClaveSirve(): Promise<{ ok: boolean; porque: string }> {
    const clave = process.env.SENDGRID_API_KEY;
    if (!clave) return { ok: false, porque: 'no hay SENDGRID_API_KEY (vive en .env.local)' };
    if (!process.env.SENDGRID_FROM_EMAIL) return { ok: false, porque: 'no hay SENDGRID_FROM_EMAIL' };
    try {
        const r = await fetch('https://api.sendgrid.com/v3/scopes', {
            headers: { Authorization: `Bearer ${clave}` },
            signal: AbortSignal.timeout(15_000),
        });
        if (r.status === 401) return { ok: false, porque: 'SendGrid la rechaza (401): está revocada o es de otra cuenta' };
        if (!r.ok) return { ok: false, porque: `SendGrid responde ${r.status}` };
        return { ok: true, porque: 'válida' };
    } catch (e: any) {
        return { ok: false, porque: `no se pudo comprobar: ${e?.message?.slice(0, 60)}` };
    }
}

/** Dónde se deja la página de copiar: la raíz del repo, que es el escritorio de Andrés. */
const REPO = process.cwd();

/**
 * Una página con el correo listo y tres botones de copiar.
 *
 * El botón del cuerpo selecciona el nodo renderizado y copia con
 * `execCommand('copy')`: eso deja en el portapapeles el HTML con formato, que
 * es lo que Gmail pega bien. `navigator.clipboard.write` con ClipboardItem sería
 * más moderno pero falla en algunos navegadores abriendo un file://, y aquí lo
 * que importa es que funcione al primer clic.
 */
function paginaDeCopiar(asunto: string, cuerpoHtml: string, correos: string[]): string {
    // Solo el interior del <body> del correo: el <html> entero dentro de otro
    // <html> confunde al navegador y a Gmail.
    const dentro = cuerpoHtml.split('<body')[1]?.split('>').slice(1).join('>').split('</body>')[0] ?? cuerpoHtml;
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Correo de caídas — copiar y pegar</title>
<style>
  body{margin:0;background:#EEF2F6;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A}
  .env{max-width:720px;margin:28px auto;padding:0 16px}
  h1{font-size:19px;margin:0 0 6px}
  .ayuda{color:#64748B;font-size:14px;margin:0 0 22px}
  .fila{background:#fff;border:1px solid #D8E0E8;border-radius:12px;padding:16px 18px;margin-bottom:14px;display:flex;gap:14px;align-items:flex-start}
  .fila .txt{flex:1;min-width:0}
  .et{font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#64748B;margin-bottom:4px}
  .val{font-size:14px;word-break:break-word;color:#0F172A}
  button{flex:0 0 auto;background:#0F6E56;color:#fff;border:0;padding:11px 18px;border-radius:9px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}
  button:hover{background:#0B5642}
  button.ok{background:#047857}
  .previa{background:#fff;border:1px solid #D8E0E8;border-radius:12px;overflow:hidden;margin-top:6px}
  .previa .barra{padding:12px 18px;border-bottom:1px solid #E8EDF2;display:flex;justify-content:space-between;align-items:center;gap:14px}
  .nota{color:#64748B;font-size:13px;margin:16px 2px 0}
</style></head><body>
<div class="env">
  <h1>Correo de caídas — listo para pegar</h1>
  <p class="ayuda">Un clic en cada botón y pégalo en Gmail. El del cuerpo copia <strong>con el diseño</strong>.</p>

  <div class="fila">
    <div class="txt"><div class="et">Asunto</div><div class="val" id="asunto">${asunto}</div></div>
    <button onclick="copiarTexto('asunto', this)">Copiar</button>
  </div>

  <div class="fila">
    <div class="txt"><div class="et">Destinatarios — ${correos.length}, para copia oculta (CCO)</div>
      <div class="val" id="correos">${correos.join(', ')}</div></div>
    <button onclick="copiarTexto('correos', this)">Copiar</button>
  </div>

  <div class="previa">
    <div class="barra">
      <div class="et" style="margin:0">Cuerpo del correo</div>
      <button onclick="copiarCuerpo(this)">Copiar el correo con formato</button>
    </div>
    <div id="cuerpo">${dentro}</div>
  </div>

  <p class="nota">Si al pegar Gmail se come el fondo gris, no pasa nada: el texto, las negritas y el botón verde llegan bien.</p>
</div>

<script>
function avisar(b, t){ const o = b.textContent; b.textContent = t; b.classList.add('ok');
  setTimeout(() => { b.textContent = o; b.classList.remove('ok'); }, 1600); }

function copiarTexto(id, b){
  const t = document.getElementById(id).innerText;
  navigator.clipboard.writeText(t).then(() => avisar(b, 'Copiado'))
    .catch(() => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a);
      a.select(); document.execCommand('copy'); a.remove(); avisar(b, 'Copiado'); });
}

/** Selecciona el cuerpo renderizado y lo copia: así va el HTML con formato. */
function copiarCuerpo(b){
  const nodo = document.getElementById('cuerpo');
  const sel = window.getSelection(); const r = document.createRange();
  r.selectNodeContents(nodo); sel.removeAllRanges(); sel.addRange(r);
  const ok = document.execCommand('copy');
  sel.removeAllRanges();
  avisar(b, ok ? 'Copiado con formato' : 'No se pudo — usa Cmd+A dentro del recuadro');
}
</script>
</body></html>`;
}

async function main() {
    console.log(APLICAR ? '📣 Enviando de verdad\n' : '🔍 SIMULACIÓN — no se manda nada\n');

    /**
     * SI SE PIDE MANDAR Y NO SE PUEDE, SE PARA ANTES DE ESCRIBIR NADA.
     *
     * Antes seguia adelante, dejaba 14 notificaciones en produccion y decia
     * "correos enviados: 0" al final, donde ya no lo lee nadie. Un aviso a
     * medias es peor que ninguno: la persona ve la campana, no ve el correo, y
     * nadie se entera de que el correo no salio.
     */
    if ((APLICAR || PRUEBA) && !SOLO_APP) {
        const clave = await laClaveSirve();
        if (!clave.ok) {
            console.error(`⛔ El correo no puede salir: ${clave.porque}.`);
            console.error('   NO se ha escrito nada. Si quieres avisar solo dentro de la app,');
            console.error('   sin correo y a sabiendas: --solo-app');
            process.exit(1);
        }
        console.log(`   Clave de SendGrid: ${clave.porque} · remitente ${process.env.SENDGRID_FROM_EMAIL}\n`);
    }

    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    let avisados = 0, correos = 0;

    for (const hq of sedes) {
        const curso = await prisma.course.findFirst({
            where: { headquartersId: hq.id, title: { contains: CURSO }, isActive: true },
            select: { id: true, durationMins: true, title: true },
        });
        if (!curso) { console.log(`── ${hq.name}: sin el curso activo`); continue; }

        const n = await contar(hq.id);
        if (n.total === 0) {
            console.log(`── ${hq.name}: cero caídas en ${DIAS} días — no se manda nada.`);
            console.log('   Un aviso que dice "han pasado 0 caídas" no explica por qué hay que hacer el curso.');
            continue;
        }

        // Solo a quien lo tiene asignado y NO lo ha aprobado.
        const asignados = await prisma.academyAssignment.findMany({
            where: { headquartersId: hq.id, moduleCode: curso.id },
            select: { userId: true },
        });
        const aprobados = new Set(
            (await prisma.userCourse.findMany({
                where: { courseId: curso.id, status: 'COMPLETED' },
                select: { employeeId: true },
            })).map(x => x.employeeId)
        );
        const gente = (await prisma.user.findMany({
            where: { id: { in: asignados.map(a => a.userId) }, isActive: true, isDeleted: false },
            select: { id: true, name: true, email: true, role: true },
        })).filter(u => !aprobados.has(u.id));

        console.log(`── ${hq.name}`);
        console.log(`   ${n.total} caídas escritas en ${DIAS} días · ${n.enElModulo} por el botón · ${n.enBitacoraSinFicha} solo en bitácora`);
        console.log(`   ${n.ultimos30Modulo} en el módulo en los últimos 30 días`);
        if (n.duplicadasDescartadas > 0) {
            console.log(`   ${n.duplicadasDescartadas} registro(s) duplicado(s) descartado(s) del conteo`);
        }
        console.log(`   ${gente.length} personas sin completar el curso`);

        const muestra = correo(gente[0]?.name?.split(' ')[0] ?? 'Compañera', n, curso.durationMins);
        const nombreMuestra = gente[0]?.name?.split(' ')[0] ?? 'Compañera';
        const encontrados = await sinPHI(hq.id, muestra.html + muestra.text + muestra.subject, nombreMuestra);
        if (encontrados.length > 0) {
            // No se imprimen los nombres: la consola queda en el scrollback y en los logs.
            console.log(`\n   ⛔ ABORTADO: el cuerpo menciona a ${new Set(encontrados).size} residente(s). Revisa el texto.`);
            process.exit(1);
        }
        console.log('   PHI: limpio — ningún nombre de residente en el cuerpo');

        if (PRUEBA) {
            if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
                console.error('   ⛔ Falta SENDGRID_API_KEY o SENDGRID_FROM_EMAIL.');
                process.exit(1);
            }
            // La general, que es la que se va a mandar de verdad.
            const g = correo(null, n, curso.durationMins);
            await sgMail.send({
                to: PRUEBA,
                from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Vivid Senior Living' },
                subject: `[PRUEBA] ${g.subject}`, text: g.text, html: g.html,
            });
            console.log(`   📨 Copia de prueba enviada a ${PRUEBA}. No se ha escrito nada en la base.`);
            continue;
        }

        if (!APLICAR) {
            const base = `/tmp/aviso-caidas-${hq.name.toLowerCase().replace(/[^a-z]+/g, '-')}`;
            const general = correo(null, n, curso.durationMins);
            writeFileSync(`${base}-general.html`, general.html);

            /**
             * LA PÁGINA DE COPIAR.
             *
             * Andrés manda este correo él, desde su Gmail. Abrir el .html en el
             * navegador y hacer Cmd+A no sirve: arrastra el fondo de la página
             * y a veces el código. Y abrirlo en un editor copia el HTML crudo,
             * que es lo que le pasó.
             *
             * Esta página pone tres botones —asunto, destinatarios, cuerpo— y
             * cada uno deja en el portapapeles exactamente lo que hace falta. El
             * del cuerpo copia HTML CON FORMATO seleccionando el nodo y usando
             * execCommand, que es lo que entiende Gmail al pegar.
             */
            const paraCopiar = paginaDeCopiar(
                general.subject, general.html,
                gente.map(u => u.email).filter(Boolean) as string[],
            );
            const fCopiar = `${REPO}/Correo caidas — copiar y pegar.html`;
            writeFileSync(fCopiar, paraCopiar);
            console.log(`   ⇢ ÁBRELO Y COPIA DE UN CLIC:  ${fCopiar}`);
            console.log(`   Asunto: ${muestra.subject}`);
            for (const u of gente) console.log(`     → ${u.name} <${u.email ?? 'sin correo'}> · ${u.role}`);
            avisados += gente.length;
            continue;
        }

        for (const u of gente) {
            const nombre = u.name?.trim().split(' ')[0] || 'Compañera';
            await prisma.notification.create({
                data: {
                    userId: u.id,
                    type: 'COURSE_COMPLETED',
                    title: 'Curso asignado: caídas',
                    message: `${n.total} caídas escritas en ${DIAS} días; ${n.enElModulo} entraron por el botón. El curso son ${curso.durationMins} min desde tu teléfono.`,
                    link: '/academy',
                },
            });
            avisados++;

            if (!SOLO_APP && u.email && process.env.SENDGRID_API_KEY) {
                try {
                    const c = correo(nombre, n, curso.durationMins);
                    await sgMail.send({
                        to: u.email,
                        from: {
                            email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                            name: 'Vivid Senior Living',
                        },
                        subject: c.subject, text: c.text, html: c.html,
                    });
                    correos++;
                    console.log(`   ✅ ${nombre} <${u.email}>`);
                } catch (e: any) {
                    console.log(`   ⚠️  ${nombre}: correo falló — ${e?.message?.slice(0, 60)}`);
                }
            } else {
                console.log(`   ✅ ${nombre} (solo app)`);
            }
        }
    }

    console.log(`\n${APLICAR ? 'Avisados' : 'Se avisaría a'}: ${avisados}${APLICAR ? ` · correos enviados: ${correos}` : ''}`);
    if (!APLICAR) console.log('Para mandarlo: npx tsx scripts/avisar-caidas.ts --confirmar');
    await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
