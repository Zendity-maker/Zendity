import { test, expect } from '@playwright/test';
import { loginAs, loginWithBadCredentials, CREDS } from './helpers/auth';

test.describe('01 — Autenticación', () => {

    test('Login Director — PIN correcto → redirige fuera de /login', async ({ page }) => {
        await loginAs(page, 'director');
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('Login Cuidador — PIN correcto → redirige a /care', async ({ page }) => {
        await loginAs(page, 'caregiver', { expectRedirect: '/care' });
        await expect(page).toHaveURL(/\/care/);
    });

    test('Login Familiar — PIN correcto → redirige a /family', async ({ page }) => {
        await loginAs(page, 'family', { expectRedirect: '/family' });
        await expect(page).toHaveURL(/\/family/);
    });

    test('Login con PIN incorrecto → permanece en /login o muestra error', async ({ page }) => {
        await loginWithBadCredentials(page, CREDS.director.email, '0000');
        // Debe seguir en /login o mostrar mensaje de error
        const stillLogin = page.url().includes('/login');
        const hasError   = await page.getByText(/error|incorrecto|inválido|credencial|CredentialsSignin/i).isVisible().catch(() => false);
        expect(stillLogin || hasError).toBeTruthy();
    });

    test('Login sin credenciales → HTML5 validation bloquea submit', async ({ page }) => {
        await page.goto('/login', { waitUntil: 'networkidle' });
        await page.click('button[type="submit"]');
        // El required del input impide submit → seguimos en /login
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/login');
    });

    test('Director accede a /corporate sin redirigir a /login', async ({ page }) => {
        await loginAs(page, 'director');
        await page.goto('/corporate', { waitUntil: 'networkidle' });
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('Cuidador accede a /care sin redirigir a /login', async ({ page }) => {
        await loginAs(page, 'caregiver', { expectRedirect: '/care' });
        await page.goto('/care', { waitUntil: 'networkidle' });
        await expect(page).toHaveURL(/\/care/);
    });

    test('Familiar accede a /family sin redirigir a /login', async ({ page }) => {
        await loginAs(page, 'family', { expectRedirect: '/family' });
        await page.goto('/family', { waitUntil: 'networkidle' });
        await expect(page).toHaveURL(/\/family/);
    });

    test('Sin sesión → /corporate redirige a /login', async ({ page }) => {
        // Sin login previo, ir directamente a /corporate
        await page.goto('/corporate', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        expect(page.url()).toContain('/login');
    });

});
