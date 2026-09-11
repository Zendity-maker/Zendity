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
    { nombre: 'caidas-panel', ruta: '/capturas/caidas', ancho: 1100, alto: 1000, esperar: 'text=Riesgo de caída' },
    { nombre: 'supervisor-mission-control', ruta: '/capturas/supervisor', ancho: 1400, alto: 820, esperar: 'text=Mission Control' },
    { nombre: 'supervisor-rondas', ruta: '/capturas/supervisor', ancho: 1400, alto: 700, esperar: 'text=Rondas de Cuidadores', bajar: 300 },
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
        await pag.setViewportSize({ width: t.ancho ?? 1100, height: t.alto ?? 900 });
        try {
            await pag.goto(BASE + t.ruta, { waitUntil: 'networkidle', timeout: 30_000 });
            if (t.esperar) await pag.waitForSelector(t.esperar, { timeout: 15_000 });
            for (const sel of t.clics ?? []) { await pag.click(sel); await pag.waitForTimeout(600); }
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
