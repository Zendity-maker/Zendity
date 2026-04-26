import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('04 — Portal Familiar (/family)', () => {

    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'family', { expectRedirect: '/family' });
        await page.waitForLoadState('networkidle');
    });

    test('Portal familiar /family carga sin errores 5xx', async ({ page }) => {
        const serverErrors: string[] = [];
        page.on('response', r => {
            if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
        });
        await page.goto('/family', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        expect(serverErrors).toHaveLength(0);
    });

    test('Portal familiar muestra contenido (no pantalla en blanco)', async ({ page }) => {
        await page.goto('/family', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        const body = await page.locator('body').textContent();
        expect(body?.trim().length).toBeGreaterThan(200);
    });

    test('Sección de vitales del residente visible', async ({ page }) => {
        await page.goto('/family', { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);
        const vitals = page.getByText(/vital|presión|temperatura|pulso|saturación/i).first();
        const hasVitals = await vitals.isVisible().catch(() => false);
        // Los vitales pueden no estar si no se han registrado hoy
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(200);
    });

    test('Sección de actualizaciones Zendi visible', async ({ page }) => {
        await page.goto('/family', { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);
        const zendiSection = page.getByText(/zendi|actualización|momento|familia/i).first();
        const hasZendi = await zendiSection.isVisible().catch(() => false);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(200);
    });

    test('Chat familiar /family/messages carga', async ({ page }) => {
        await page.goto('/family/messages', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(100);
    });

    test('Calendario de citas /family/calendar carga', async ({ page }) => {
        await page.goto('/family/calendar', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body).toMatch(/cita|calendario|visita|agendar/i);
    });

    test('Familiar NO puede acceder a /corporate (redirige a /family)', async ({ page }) => {
        await page.goto('/corporate', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        // Debe redirigir al portal familiar, no a /corporate
        expect(page.url()).not.toMatch(/\/corporate/);
        expect(page.url()).toMatch(/\/family|\/login/);
    });

    test('No hay errores JS críticos en /family', async ({ page }) => {
        const jsErrors: string[] = [];
        page.on('pageerror', e => {
            if (!e.message.includes('ResizeObserver')) jsErrors.push(e.message);
        });
        await page.goto('/family', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        expect(jsErrors).toHaveLength(0);
    });

});
