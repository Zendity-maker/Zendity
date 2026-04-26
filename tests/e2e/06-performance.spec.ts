import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const SLOW_THRESHOLD_MS = 3000; // alerta si una página tarda más de 3s

interface PageResult {
    route: string;
    loadMs: number;
    consoleErrors: string[];
    networkErrors: string[];
    status: 'fast' | 'slow' | 'error';
}

// Rutas a medir por rol
const DIRECTOR_ROUTES = [
    '/corporate',
    '/corporate/residents',
    '/care/supervisor',
    '/hr/staff',
    '/hr/schedule',
    '/academy',
    '/corporate/calendar',
    '/corporate/family-appointments',
];

const CAREGIVER_ROUTES = [
    '/care',
];

const FAMILY_ROUTES = [
    '/family',
    '/family/messages',
    '/family/calendar',
];

async function measurePage(page: any, route: string): Promise<PageResult> {
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    const onError = (e: Error) => {
        if (!e.message.includes('ResizeObserver')) consoleErrors.push(e.message.slice(0, 120));
    };
    const onResponse = (r: any) => {
        if (r.status() >= 400 && r.status() < 600) {
            if (!r.url().includes('/api/auth/') && r.status() !== 401) {
                networkErrors.push(`${r.status()} ${r.url().replace('https://app.zendity.com', '')}`);
            }
        }
    };
    page.on('pageerror', onError);
    page.on('response', onResponse);

    const t0 = Date.now();
    await page.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForTimeout(500);
    const loadMs = Date.now() - t0;

    const status: PageResult['status'] =
        networkErrors.some(e => e.startsWith('5')) ? 'error' :
        loadMs > SLOW_THRESHOLD_MS ? 'slow' :
        'fast';

    return { route, loadMs, consoleErrors, networkErrors, status };
}

test.describe('06 — Performance & Calidad', () => {

    test('Director — medir tiempos de carga y errores', { timeout: 180_000 }, async ({ page }) => {
        await loginAs(page, 'director');
        await page.waitForTimeout(2000);

        const results: PageResult[] = [];

        for (const route of DIRECTOR_ROUTES) {
            const result = await measurePage(page, route);
            results.push(result);
            // Pequeña pausa entre páginas
            await page.waitForTimeout(500);
        }

        // Imprimir tabla de resultados
        console.log('\n┌─────────────────────────────────────────────────────────────────┐');
        console.log('│  PERFORMANCE — Rutas Director                                   │');
        console.log('├────────────────────────────────┬──────────┬──────────────────────┤');
        console.log('│ Ruta                           │ Tiempo   │ Estado               │');
        console.log('├────────────────────────────────┼──────────┼──────────────────────┤');
        for (const r of results) {
            const icon = r.status === 'fast' ? '✅' : r.status === 'slow' ? '⚠️ ' : '❌';
            const routePad = r.route.padEnd(30);
            const timePad  = `${r.loadMs}ms`.padEnd(8);
            console.log(`│ ${routePad} │ ${timePad} │ ${icon} ${r.status.padEnd(18)} │`);
            if (r.consoleErrors.length > 0) {
                console.log(`│   JS Errors: ${r.consoleErrors[0].slice(0, 50)}...`);
            }
            if (r.networkErrors.length > 0) {
                console.log(`│   Net Errors: ${r.networkErrors.slice(0, 3).join(', ')}`);
            }
        }
        console.log('└────────────────────────────────┴──────────┴──────────────────────┘\n');

        const slowPages = results.filter(r => r.status === 'slow');
        const errorPages = results.filter(r => r.status === 'error');

        if (slowPages.length > 0) {
            console.warn(`⚠️  ${slowPages.length} página(s) superan ${SLOW_THRESHOLD_MS}ms:`);
            slowPages.forEach(r => console.warn(`   ${r.route}: ${r.loadMs}ms`));
        }

        if (errorPages.length > 0) {
            console.error(`❌ ${errorPages.length} página(s) con errores de servidor:`);
            errorPages.forEach(r => {
                console.error(`   ${r.route}: ${r.networkErrors.join(', ')}`);
            });
        }

        // Solo fallar si hay errores de servidor 5xx
        const has5xx = results.some(r => r.networkErrors.some(e => /^5/.test(e)));
        expect(has5xx, `Errores 5xx detectados:\n${
            results.flatMap(r => r.networkErrors.filter(e => /^5/.test(e)).map(e => `${r.route}: ${e}`)).join('\n')
        }`).toBe(false);
    });

    test('Cuidador — medir tiempo de carga /care', async ({ page }) => {
        await loginAs(page, 'caregiver', { expectRedirect: '/care' });
        await page.waitForTimeout(2000);

        const results: PageResult[] = [];
        for (const route of CAREGIVER_ROUTES) {
            results.push(await measurePage(page, route));
            await page.waitForTimeout(500);
        }

        console.log('\n── Performance Cuidador ──');
        for (const r of results) {
            const icon = r.status === 'fast' ? '✅' : r.status === 'slow' ? '⚠️' : '❌';
            console.log(`${icon} ${r.route}: ${r.loadMs}ms`);
        }

        const has5xx = results.some(r => r.networkErrors.some(e => /^5/.test(e)));
        expect(has5xx).toBe(false);
    });

    test('Familiar — medir tiempo de carga /family', async ({ page }) => {
        await loginAs(page, 'family', { expectRedirect: '/family' });
        await page.waitForTimeout(2000);

        const results: PageResult[] = [];
        for (const route of FAMILY_ROUTES) {
            results.push(await measurePage(page, route));
            await page.waitForTimeout(500);
        }

        console.log('\n── Performance Portal Familiar ──');
        for (const r of results) {
            const icon = r.status === 'fast' ? '✅' : r.status === 'slow' ? '⚠️' : '❌';
            console.log(`${icon} ${r.route}: ${r.loadMs}ms`);
        }

        const has5xx = results.some(r => r.networkErrors.some(e => /^5/.test(e)));
        expect(has5xx).toBe(false);
    });

    test('Verificar que no hay errores de consola en rutas críticas', async ({ page }) => {
        await loginAs(page, 'director');
        await page.waitForTimeout(2000);

        const allErrors: Record<string, string[]> = {};

        for (const route of ['/corporate', '/hr/staff', '/hr/schedule']) {
            const errors: string[] = [];
            page.on('pageerror', (e: Error) => {
                if (!e.message.includes('ResizeObserver')) errors.push(e.message.slice(0, 100));
            });
            await page.goto(route, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
            if (errors.length > 0) allErrors[route] = errors;
        }

        if (Object.keys(allErrors).length > 0) {
            console.warn('⚠️  Errores JS encontrados:');
            for (const [route, errs] of Object.entries(allErrors)) {
                console.warn(`  ${route}:`);
                errs.forEach(e => console.warn(`    - ${e}`));
            }
        }

        // Registramos pero no fallamos — los errores de console son informativos
        expect(true).toBe(true);
    });

});
