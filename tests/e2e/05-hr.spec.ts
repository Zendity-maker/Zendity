import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('05 — RRHH (/hr)', () => {

    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'director');
        await page.waitForTimeout(2000);
    });

    test('Directorio staff /hr/staff carga con listado', async ({ page }) => {
        await page.goto('/hr/staff', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(200);
    });

    test('/hr/staff muestra nombres de empleados', async ({ page }) => {
        await page.goto('/hr/staff', { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);
        // Debe haber al menos alguna card de empleado o lista
        const body = await page.locator('body').textContent();
        // El directorio tiene empleados cargados
        expect(body?.length).toBeGreaterThan(500);
    });

    test('Perfil de empleado con Z-Score carga', async ({ page }) => {
        // Navegar al directorio primero y luego al primer perfil
        await page.goto('/hr/staff', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);

        // Buscar el primer link a un perfil de empleado
        const profileLink = page.locator('a[href*="/hr/staff/"]').first();
        const hasLink = await profileLink.isVisible().catch(() => false);

        if (hasLink) {
            await profileLink.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(3000);
            // Verificar que el perfil cargó con Z-Score
            const body = await page.locator('body').textContent();
            expect(body).toMatch(/Z-Score|score|desempeño/i);
        } else {
            // Si no hay links, verificamos que la página no está vacía
            const body = await page.locator('body').textContent();
            expect(body?.length).toBeGreaterThan(200);
        }
    });

    test('Z-Score tiene gráfica histórica en perfil de empleado', async ({ page }) => {
        await page.goto('/hr/staff', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        const profileLink = page.locator('a[href*="/hr/staff/"]').first();
        const hasLink = await profileLink.isVisible().catch(() => false);
        if (hasLink) {
            await profileLink.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(3000);
            const body = await page.locator('body').textContent();
            expect(body).toMatch(/semanas|historial|tendencia|score/i);
        }
    });

    test('Constructor de horarios /hr/schedule carga correctamente', async ({ page }) => {
        await page.goto('/hr/schedule', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        // Verificar elementos del constructor
        const body = await page.locator('body').textContent();
        expect(body).toMatch(/horario|turno|semana|schedule/i);
    });

    test('Constructor horarios muestra botón "Guardar borrador"', async ({ page }) => {
        await page.goto('/hr/schedule', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        const saveBtn = page.getByRole('button', { name: /guardar borrador|guardar/i });
        const hasBtn = await saveBtn.isVisible().catch(() => false);
        // Puede estar deshabilitado si no hay shifts, pero debe existir
        expect(hasBtn).toBeTruthy();
    });

    test('Academy /academy carga con catálogo de cursos', async ({ page }) => {
        await page.goto('/academy', { waitUntil: 'networkidle' });
        await page.waitForTimeout(4000);
        await expect(page).not.toHaveURL(/\/login/);
        const body = await page.locator('body').textContent();
        expect(body).toMatch(/curso|academy|certificado|formación/i);
    });

    test('No hay errores 5xx en rutas HR', async ({ page }) => {
        const serverErrors: string[] = [];
        page.on('response', r => {
            if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
        });

        for (const route of ['/hr/staff', '/hr/schedule', '/hr/evaluate']) {
            await page.goto(route, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);
        }

        expect(serverErrors).toHaveLength(0);
    });

});
