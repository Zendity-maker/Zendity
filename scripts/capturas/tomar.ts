/**
 * Fotografía las pantallas de Zendity para los cursos de Academy.
 *
 * Visita cada ruta del andamio (src/app/capturas/*), que monta la pantalla REAL
 * con residentes inventados, y guarda el PNG en public/academy/capturas/.
 *
 * Requiere el servidor de desarrollo corriendo en :3000.
 *
 *   npx tsx scripts/capturas/tomar.ts              todas
 *   npx tsx scripts/capturas/tomar.ts caidas       una sola
 */
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync, statSync } from 'fs';

const BASE = 'http://localhost:3000';
const DESTINO = 'public/academy/capturas';

interface Toma {
    /** nombre del archivo, sin extensión */
    nombre: string;
    /** ruta del andamio */
    ruta: string;
    ancho?: number;
    alto?: number;
    /** selector que tiene que aparecer antes de disparar */
    esperar?: string;
    /** recorta a este selector en vez de a la página entera */
    recortar?: string;
    /** clics previos, para fotografiar un modal o una pestaña */
    clics?: string[];
    /**
     * Foto de la pagina ENTERA en vez de lo que cabe en pantalla.
     *
     * Por defecto NO, y es deliberado: la primera version fotografiaba entera
     * y el panel del supervisor salia de 4.000 px de alto y 900 KB. Una foto
     * asi no enseña nada —no hay donde mirar— ademas de pesar. Una captura
     * util encuadra UNA cosa: el aviso sin atender, el boton que hay que
     * pulsar, el campo que falta.
     */
    entera?: boolean;
    /** cuanto bajar antes de disparar, en px */
    bajar?: number;
}

const TOMAS: Toma[] = [
    // ── /care/caidas
    { nombre: 'caidas-panel', ruta: '/capturas/caidas', ancho: 1100, alto: 1000, esperar: 'text=Riesgo de caída' },
    //   El bloque de riesgo con los cuatro contadores y las caídas de 90 días con su gravedad.
    // ── /care/supervisor
    { nombre: 'supervisor-mission-control', ruta: '/capturas/supervisor', ancho: 1400, alto: 820, esperar: 'text=Mission Control' },
    //   El turno activo, los contadores del piso y los accesos del supervisor.
    { nombre: 'supervisor-rondas', ruta: '/capturas/supervisor', ancho: 1400, alto: 700, esperar: 'text=Rondas de Cuidadores', bajar: 300 },
    //   Las rondas por piso: cada cuidadora con su grupo de color y su porcentaje.
    // ── /care
    { nombre: "care-turno-lista", ruta: '/capturas/care-turno', ancho: 1400, alto: 1050, esperar: "text=Rosa Medina" },
    //   LA FOTO PRINCIPAL, la que piden los 21 cursos: el encabezado con el turno de mañana abierto, el chip del grupo azul, el botón Entregar Turno, la nota 
    { nombre: "care-turno-tarjeta", ruta: '/capturas/care-turno', ancho: 1400, alto: 900, esperar: "text=Rosa Medina", recortar: "div.grid.grid-cols-2.gap-3 > div:first-child" },
    //   Una tarjeta de residente entera (Rosa Medina, 204), que es la unidad de trabajo del turno: baño listo, 2/3 comidas, rotación al día, meds pendientes c
    { nombre: "care-turno-entregar", ruta: '/capturas/care-turno', ancho: 1400, alto: 1000, esperar: "text=Cierre de turno", clics: ["text=Entregar Turno"] },
    //   El asistente de cierre: los tres pasos (lees y firmas, lo lee el supervisor, entra el próximo turno), el "Estado Limpio" de pendientes, el resumen de 
    { nombre: "care-turno-ausente", ruta: '/capturas/care-turno', ancho: 1400, alto: 900, esperar: "text=En Hospital", recortar: "div.grid.grid-cols-2.gap-3 > div:nth-child(4)" },
    //   Pedro Santana (103) trasladado: sigue en el censo con el sello "🚑 En Hospital" y el botón "Registrar Retorno al Piso", y su tarjeta ya no pide medicam
    { nombre: "care-turno-notas", ruta: '/capturas/care-turno', ancho: 1400, alto: 900, esperar: "text=Notas y tareas pendientes", clics: ["text=Ver todas"] },
    //   La bandeja de notas y tareas del supervisor con el texto completo y el botón "Marcar como atendida". La franja de arriba corta el texto; aquí se ve en
    // ── /Users/andresfloresruiz/Desktop/Zendity/src/app/capturas/care-hub/page.tsx
    { nombre: "care-hub-aterrizaje", ruta: '/capturas/care-hub', ancho: 820, alto: 760, esperar: "text=Iniciar Turno" },
    //   La pantalla entera tal como la abre la cuidadora al empezar: logo, "BUENOS DÍAS / Ana", las tres puertas (Iniciar Turno, Academy, Mis Observaciones), 
    { nombre: "care-hub-puertas", ruta: '/capturas/care-hub', ancho: 820, alto: 760, esperar: "text=Iniciar Turno", recortar: ".max-w-md.space-y-4" },
    //   Primer plano de las tres tarjetas y el botón de salir, sin el saludo. Para el paso "pulsa Iniciar Turno para abrir tu turno" y para explicar que Acade
    { nombre: "care-hub-observacion-pendiente", ruta: '/capturas/care-hub', ancho: 820, alto: 760, esperar: "text=2 pendientes de respuesta", recortar: "button:has-text(\"Mis Observaciones\")" },
    //   Solo la tarjeta de Mis Observaciones con "2 pendientes de respuesta" y la pastilla ámbar con el 2. Enseña a reconocer que dirección le pidió una expli
    // ── /care — el pack de medicamentos, el acto central del turno
    { nombre: 'care-pack-meds', ruta: '/capturas/care-meds', ancho: 1300, alto: 950, esperar: 'text=Administrar pack', recortar: 'div.fixed' },
    //   El pack de las 8:00 con su medicamento, "¿Cuándo se hizo?", el recuadro de la
    //   firma y la frase de los 5 correctos que se certifica al firmar.
    // ── /care/hallazgos
    { nombre: "hallazgos-tarjeta-pendiente", ruta: '/capturas/care-hallazgos', ancho: 1000, alto: 900, esperar: "text=Debió avisar y no avisó", recortar: ".space-y-3 > div:first-child" },
    //   LA TOMA PRINCIPAL. Una tarjeta PENDIENTE entera: la etiqueta de tipo en rosa ('Debió avisar y no avisó'), Rosa Medina Hab. 204, la frase original de l
    { nombre: "hallazgos-pantalla", ruta: '/capturas/care-hallazgos', ancho: 1000, alto: 1000, esperar: "text=Lo que Zendi encontró" },
    //   La pantalla completa desde arriba: el título con el brillo, la advertencia 'No son hechos: son preguntas', las dos pestañas (Por decidir / Confirmados
    { nombre: "hallazgos-tres-salidas", ruta: '/capturas/care-hallazgos', ancho: 1000, alto: 700, esperar: "text=Ya se puede documentar", recortar: ".space-y-3 > div:nth-child(2) .space-y-2" },
    //   Los tres botones solos, recortados: 'Ya se puede documentar' en teal, 'Sí, para evaluar' y 'No hace falta', cada uno con la línea que explica qué pasa
    { nombre: "hallazgos-donde-se-documenta", ruta: '/capturas/care-hallazgos', ancho: 1000, alto: 1200, esperar: "text=Ya se puede documentar", recortar: ".space-y-3 > div:nth-child(2)", clics: [".space-y-3 > div:nth-child(2) button:has-text(\"Ya se puede documentar\")"] },
    //   El panel que se abre al decir 'ya se puede documentar': la lista de sitios reales donde va la información (el botón de Caída, Alerta Piel/UPP, Vitales
    { nombre: "hallazgos-confirmados", ruta: '/capturas/care-hallazgos', ancho: 1000, alto: 900, esperar: "text=Por decidir", clics: ["text=Confirmados"] },
    //   La segunda pestaña: lo ya confirmado esperando que dirección lo construya, con el botón verde 'Ya está construido — quitarlo de la lista'. Enseña que 
    // ── /Users/andresfloresruiz/Desktop/Zendity/src/app/capturas/care-cambios/page.tsx
    { nombre: "cambios-lista", ruta: '/capturas/care-cambios', ancho: 900, alto: 800, esperar: "text=3 residentes con lo mismo en piel" },
    //   La pantalla entrando por arriba: el titulo, la banda roja del patron con los tres nombres, y debajo las dos tarjetas que pasaron el plazo (4 dias y 3 
    { nombre: "cambios-patron", ruta: '/capturas/care-cambios', ancho: 900, alto: 800, esperar: "text=3 residentes con lo mismo en piel", recortar: "div.border-rose-300" },
    //   Solo la banda del patron, recortada. '3 residentes con lo mismo en piel', la pista ('todos del grupo BLUE, todos en la planta 2') y los tres nombres e
    { nombre: "cambios-revisar", ruta: '/capturas/care-cambios', ancho: 900, alto: 900, esperar: "text=3 residentes con lo mismo en piel", recortar: ".space-y-3 > div:nth-child(1)", clics: [".space-y-3 > div:nth-child(1) button:has-text(\"Revisar\")", "button:has-text(\"Queda en observación\")"] },
    //   La tarjeta de Luis Ortega abierta: las cuatro decisiones posibles, 'Queda en observacion' escogida en teal, y debajo el cuadro que dice literalmente '
    { nombre: "cambios-ulcera", ruta: '/capturas/care-cambios', ancho: 900, alto: 900, esperar: "text=3 residentes con lo mismo en piel", recortar: ".space-y-3 > div:nth-child(3)", clics: [".space-y-3 > div:nth-child(3) button:has-text(\"Revisar\")"] },
    //   La tarjeta de PIEL (Rosa Medina, 204) abierta, con el boton rojo 'Esto es una ulcera — declararla' encima de las cuatro decisiones normales. Enseña el
    // ── /mi-desempeno
    { nombre: "mi-desempeno", ruta: '/capturas/mi-desempeno', ancho: 900, alto: 1000, esperar: "text=Lo que reportaste del residente" },
    //   La pantalla completa como la abre una cuidadora: tres medidas, cada una con su valor y su comparacion (19 de 21 turnos cerrados = 90%; 14 reportes = 0
    { nombre: "mi-desempeno-medida-con-referencia", ruta: '/capturas/mi-desempeno', ancho: 900, alto: 400, esperar: "text=la media de tu turno de noche", recortar: "div.space-y-4 > div:nth-of-type(2)" },
    //   Una sola tarjeta en grande: la regla de la pantalla. '14 en 21 turnos' arriba, y debajo en teal '0.67 por turno · la media de tu turno de noche es 0.2
    { nombre: "mi-desempeno-90-dias", ruta: '/capturas/mi-desempeno', ancho: 900, alto: 1050, esperar: "text=54 de 61", clics: ["text=90 días"] },
    //   La misma pantalla tras pulsar '90 dias': el boton queda marcado en teal, el subtitulo cambia y los tres numeros cambian con el (54 de 61, 0.61 por tur
    { nombre: "mi-desempeno-observaciones-rrhh", ruta: '/capturas/mi-desempeno', ancho: 900, alto: 400, esperar: "text=Amonestación", recortar: "div.space-y-4 > div:nth-of-type(4)", clics: ["text=90 días"] },
    //   El bloque de RRHH con dos entradas de severidad distinta (Puntualidad · Observacion, Uniforme · Amonestacion) y la linea que explica que solo salen la
    // ── /care/enfermeria (la lista de trabajo) + /care/nursing (la pantalla «Piel, úlceras y rotación»). Las dos se montan en el mismo andamio: src/app/capturas/care-enfermeria/page.tsx
    { nombre: "enfermeria-piel-ulceras-rotacion", ruta: '/capturas/care-enfermeria', ancho: 1280, alto: 900, esperar: "text=Piel, úlceras y rotación" },
    //   La pantalla entera de un vistazo: el título, los 2 reportes de piel que el piso mandó y nadie ha decidido si son úlcera, los seis estados de rotación 
    { nombre: "enfermeria-rotacion-seis-estados", ruta: '/capturas/care-enfermeria', ancho: 1280, alto: 900, esperar: "text=Piel, úlceras y rotación", recortar: "#pantalla-piel > div > .max-w-6xl", clics: ["text=Ocultar"] },
    //   Los seis residentes, uno por estado, sin la cabecera que se repite en las demás fotos. Enseña qué significa cada color: Rosa Medina vencida con úlcera
    { nombre: "enfermeria-curacion-plan", ruta: '/capturas/care-enfermeria', ancho: 1280, alto: 900, esperar: "text=Piel, úlceras y rotación", clics: ["button:has-text(\"UPP Sacro\")"] },
    //   El modal que se abre al pulsar la etiqueta de la úlcera de Rosa Medina: sacro estadio 3, los DOS relojes separados (curada hace 9d / vista hace 9d), l
    { nombre: "enfermeria-piel-sin-decidir", ruta: '/capturas/care-enfermeria', ancho: 1280, alto: 900, esperar: "text=reportes de piel sin decidir", recortar: "#pantalla-piel .bg-fuchsia-50" },
    //   Solo el panel fucsia, apretado y sin nada alrededor: los dos reportes que mandó el piso —Elena Figueroa con enrojecimiento en el talón que no se aclar
    { nombre: "enfermeria-lista-de-trabajo", ruta: '/capturas/care-enfermeria', ancho: 1280, alto: 1100, esperar: "text=Lo que espera una decisión", recortar: "#pantalla-pendientes > div" },
    //   La otra pantalla, /care/enfermeria: la puerta. Las ocho líneas de trabajo pendiente ordenadas por urgencia —rojo arriba (cambios del piso pasados de p
    // ── /corporate/patients/intake
    { nombre: "intake-revisiones-pendientes", ruta: '/capturas/intake', ancho: 1280, alto: 900, esperar: "text=Ingresos pendientes de confirmación clínica", recortar: "div.bg-rose-50" },
    //   El panel de revisiones pendientes con los DOS estados, que es lo que hay que enseñar: Carmen Delgado lleva 4 días (en rojo) y se puede confirmar de un
    { nombre: "intake-indice-pasos", ruta: '/capturas/intake', ancho: 1280, alto: 900, esperar: "text=Bloques de Admisión", recortar: "div.bg-white:has(> h3)" },
    //   El índice lateral solo, con los seis bloques de admisión y sus nombres reales: Identidad Base, Triage Clínico, PAI y Riesgos, Log Farmacológico, Docum
    { nombre: "intake-asistente-arranque", ruta: '/capturas/intake', ancho: 1280, alto: 1200, esperar: "text=Bloques de Admisión" },
    //   La cabina entera tal como se abre: el panel rosa de revisiones arriba, la cabecera Intake Maestro con el indicador de sincronismo, y debajo el índice 
    { nombre: "intake-paso-1-identidad", ruta: '/capturas/intake', ancho: 1280, alto: 900, esperar: "text=Identidad Fundamental", recortar: "div.flex-1.bg-white" },
    //   El primer paso solo y en grande: el campo Nombre Completo (obligatorio) con su ejemplo, y el aviso de Punto de Control Operativo que explica que al es
    { nombre: "intake-paso-3-riesgos", ruta: '/capturas/intake', ancho: 1280, alto: 900, esperar: "text=Bloques de Admisión", recortar: "div.flex-1.bg-white", clics: ["text=Dieta, UPP, Caídas"] },
    //   El bloque de PAI y Riesgos: dieta, movilidad, continencia y los dos marcadores con sus escalas, Downton (caídas) y Braden (UPP), que cambian de teal a
    { nombre: "intake-paso-4-emar", ruta: '/capturas/intake', ancho: 1280, alto: 900, esperar: "text=Bloques de Admisión", recortar: "div.flex-1.bg-white", clics: ["text=eMAR Borrador"] },
    //   El Inventario Farmacológico: cómo se añade un medicamento y se le marcan los horarios de distribución (05:00 AM … 10:00 PM, PRN). Es el paso que deja 
    // ── /academy
    { nombre: "academy-entrada", ruta: '/capturas/academy-curso', ancho: 1440, alto: 900, esperar: "text=Centro de Formación" },
    //   Lo primero que ve la empleada al entrar: el encabezado institucional con su expediente (Aprobados 3/10, barra al 30%), la recomendacion de Zendi con s
    { nombre: "academy-tarjetas", ruta: '/capturas/academy-curso', ancho: 1440, alto: 900, esperar: "text=Plan de estudios", recortar: "div.space-y-5:has(h3:has-text(\"Operaciones de Piso\"))" },
    //   Una categoria completa: el titulo de la seccion con su conteo de cursos y una fila de tres tarjetas con portada, sello de categoria, duracion, credito
    { nombre: "academy-tarjeta", ruta: '/capturas/academy-curso', ancho: 1440, alto: 900, esperar: "text=Plan de estudios", recortar: ".grid > div" },
    //   Una sola tarjeta ('Cuidado Geriatrico General') para explicar sus partes: portada, categoria sobre la imagen, titulo, descripcion, 40 min · 30 credito
    { nombre: "academy-curso-aprobado", ruta: '/capturas/academy-curso', ancho: 1440, alto: 900, esperar: "text=Plan de estudios", recortar: "div.rounded-2xl.border-teal-200" },
    //   Como cambia la tarjeta cuando el curso ya esta aprobado: sello 'Aprobado' y el boton 'Imprimir certificado' activo. Al lado de la anterior enseña los 
    { nombre: "academy-formacion-asignada", ruta: '/capturas/academy-curso', ancho: 1440, alto: 900, esperar: "text=Formación asignada", recortar: "div.border-amber-200.rounded-3xl" },
    //   El bloque ambar de formacion asignada con sus dos motivos distintos —'Certificacion geriatrica' e 'Incidente de cuidado del residente'—: lo que el hog
    { nombre: "academy-recomendacion-zendi", ruta: '/capturas/academy-curso', ancho: 1440, alto: 900, esperar: "text=Zendi te recomienda", recortar: "div.mb-6.rounded-2xl.shadow-sm" },
    //   La recomendacion de Zendi con su motivo real ('El mes pasado atendiste 3 caidas') y el contador de formacion del ano 3/4 (1376x131).
    { nombre: "academy-cuadernillo-indice", ruta: '/capturas/academy-curso', ancho: 1100, alto: 900, esperar: "text=Plan de estudios", clics: ["button:has-text(\"Comenzar\") >> nth=0"] },
    //   Lo que pasa al pulsar Comenzar: la portada del cuadernillo a pantalla completa con la categoria, el titulo, el indice REAL de las cinco secciones con 
];

async function main() {
    const filtro = process.argv[2];
    const tomas = filtro ? TOMAS.filter(t => t.nombre.includes(filtro)) : TOMAS;
    if (!tomas.length) { console.log(`Ninguna toma coincide con "${filtro}".`); return; }
    if (!existsSync(DESTINO)) mkdirSync(DESTINO, { recursive: true });

    const navegador = await chromium.launch();
    /**
     * PESO. La captura se ve en una tableta, en el wifi del hogar, dentro de un
     * curso que puede llevar ocho. A escala 2 el panel del supervisor pesaba
     * 1.5 MB en PNG: nitidez que nadie ve y medio megabyte por foto.
     *
     * 1.75 sobre una columna de ~620px sigue siendo mas del doble de pixeles
     * de los que la pantalla puede enseñar, y JPEG al 90 sobre una interfaz
     * plana no deja artefactos visibles en el texto.
     */
    const ctx = await navegador.newContext({ deviceScaleFactor: 1.75 });
    let ok = 0;
    for (const t of tomas) {
        const pag = await ctx.newPage();
        const avisos: string[] = [];
        pag.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') avisos.push(m.text()); });
        pag.on('pageerror', e => avisos.push(`pageerror: ${e.message}`));
        await pag.setViewportSize({ width: t.ancho ?? 1100, height: t.alto ?? 900 });
        try {
            await pag.goto(BASE + t.ruta, { waitUntil: 'networkidle', timeout: 30_000 });
            /**
             * LOS CLICS VAN ANTES DE ESPERAR, no al reves.
             *
             * Estaba al reves y se llevo cuatro capturas por delante: esperaba
             * "Cierre de turno" —que solo existe DESPUES de pulsar "Entregar
             * Turno"— y luego pulsaba. Esperar quince segundos algo que aun no
             * puede existir, y darlo por fallido.
             */
            await pag.waitForTimeout(1200); // que hidrate antes de tocar nada
            for (const sel of t.clics ?? []) { await pag.click(sel); await pag.waitForTimeout(900); }
            if (t.esperar) await pag.waitForSelector(t.esperar, { timeout: 15_000 });

            /**
             * NO GUARDAR UNA FOTO DE UN ERROR NI DE UN SPINNER.
             *
             * Sin esto el script dice "✓" igual: guarda el overlay rojo de Next
             * o una pantalla en blanco con la ruedita, y el fallo no aparece
             * hasta que alguien abre el curso y ve la foto. Un andamio al que
             * le falta un fixture se queda cargando para siempre, y eso es
             * exactamente lo que hay que cazar aqui.
             */
            const roto = await pag.evaluate(() => {
                // El <nextjs-portal> SIEMPRE existe en desarrollo (es el
                // indicador, que ocultamos por CSS). Lo que delata un error es
                // lo que lleva DENTRO, en su shadow root.
                const portal = document.querySelector('nextjs-portal') as any;
                const dentro = portal?.shadowRoot?.textContent ?? '';
                const error = /Runtime|Unhandled|Build Error|Failed to compile/i.test(dentro);
                const texto = document.body.innerText ?? '';
                return {
                    error, detalle: dentro.slice(0, 120).replace(/\s+/g, ' '),
                    vacia: texto.trim().length < 120,
                    muestra: texto.slice(0, 90).replace(/\s+/g, ' '),
                };
            });
            if (roto.error) throw new Error(`error de Next en la pantalla: ${roto.detalle}`);
            if (roto.vacia) throw new Error(`la pantalla salio casi vacia — ¿falta un fixture? "${roto.muestra}"`);
            const fallos = avisos.filter(a => a.startsWith('pageerror:'));
            if (fallos.length) throw new Error(fallos[0].slice(0, 140));

            const sinFixture = avisos.filter(a => a.includes('[andamio] sin fixture'));
            if (sinFixture.length) {
                console.log(`     · ${sinFixture.length} peticion(es) sin fixture (se pintan vacias):`);
                [...new Set(sinFixture.map(a => a.split('sin fixture:')[1]?.trim()))].slice(0, 5)
                    .forEach(u => console.log(`       ${u}`));
            }
            if (t.bajar) { await pag.evaluate((y) => window.scrollTo(0, y), t.bajar); await pag.waitForTimeout(400); }
            await pag.waitForTimeout(800); // que terminen las animaciones
            const destino = `${DESTINO}/${t.nombre}.jpg`;
            if (t.recortar) {
                const el = await pag.waitForSelector(t.recortar, { timeout: 10_000 });
                await el.screenshot({ path: destino, type: 'jpeg', quality: 90 });
            } else {
                await pag.screenshot({ path: destino, fullPage: !!t.entera, type: 'jpeg', quality: 90 });
            }
            const kb = Math.round(statSync(destino).size / 1024);
            console.log(`  ✓ ${t.nombre}.jpg  ${kb} KB${kb > 400 ? '  ← pesada' : ''}`);
            ok++;
        } catch (e: any) {
            console.log(`  ✗ ${t.nombre}: ${e.message.split('\n')[0]}`);
        }
        await pag.close();
    }
    await navegador.close();
    console.log(`\n${ok} de ${tomas.length} capturas en ${DESTINO}/`);
}
main().catch(e => { console.error(e); process.exit(1); });
