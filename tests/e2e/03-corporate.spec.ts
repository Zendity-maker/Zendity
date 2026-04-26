import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('03 — Panel Corporativo (/corporate)', () => {

    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'director');
        // Director va a "/" → que lo lleve a donde sea pero no login
        await page.waitForTimeout(2000);
    });

    test('Dashboard /corporate carga sin errores 5xx', async ({ page }) => {
        const serverErrors: string[] = [];
        page.on('response', r => {
            if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
        });
        await page.goto('/corporate', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        expect(serverErrors).toHaveLength(0);
    });

    test('Directorio de residentes /corporate/residents carga', async ({ page }) => {
        await page.goto('/corporate/residents', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(200);
    });

    test('Constructor de horarios /hr/schedule carga', async ({ page }) => {
        await page.goto('/hr/schedule', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        // Verifica que cargó el constructor
        const body = await page.locator('body').textContent();
        expect(body).toMatch(/horario|schedule|turno/i);
    });

    test('Mission Control supervisor /care/supervisor carga', async ({ page }) => {
        await page.goto('/care/supervisor', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(200);
    });

    test('Centro de triage /corporate/triage carga', async ({ page }) => {
        const res = await page.goto('/corporate/triage', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('Calendario institucional /corporate/calendar carga', async ({ page }) => {
        await page.goto('/corporate/calendar', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(200);
    });

    test('Módulo HR — directorio staff /hr/staff carga', async ({ page }) => {
        await page.goto('/hr/staff', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(200);
    });

    test('Academy /academy carga con cursos', async ({ page }) => {
        await page.goto('/academy', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(100);
    });

    test('Citas familiares /corporate/family-appointments carga', async ({ page }) => {
        await page.goto('/corporate/family-appointments', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('Broadcast familiar /corporate/family-broadcast carga', async ({ page }) => {
        await page.goto('/corporate/family-broadcast', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('Módulo de admisión wizard /corporate/admission carga', async ({ page }) => {
        await page.goto('/corporate/admission', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(100);
    });

    test('No hay errores JS críticos en /corporate', async ({ page }) => {
        const jsErrors: string[] = [];
        page.on('pageerror', e => {
            // Ignorar ResizeObserver que es cosmético
            if (!e.message.includes('ResizeObserver')) jsErrors.push(e.message);
        });
        await page.goto('/corporate', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        expect(jsErrors).toHaveLength(0);
    });

});
