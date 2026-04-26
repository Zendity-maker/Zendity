import { Page, expect } from '@playwright/test';

// ── Credenciales de prueba por rol ─────────────────────────────────────────
export const CREDS = {
    director: {
        email: process.env.DIRECTOR_EMAIL ?? 'andrestyflores@gmail.com',
        pin:   process.env.DIRECTOR_PIN   ?? '1234',
    },
    caregiver: {
        email: process.env.CAREGIVER_EMAIL ?? 'medelin22garcias@icloud.com',
        pin:   process.env.CAREGIVER_PIN   ?? '1997',
    },
    family: {
        email: process.env.FAMILY_EMAIL ?? 'andrestyflores2@gmail.com',
        pin:   process.env.FAMILY_PIN   ?? '544555',
    },
};

// ── Helper genérico de login ───────────────────────────────────────────────
export async function loginAs(
    page: Page,
    role: keyof typeof CREDS,
    options: { expectRedirect?: string; timeout?: number } = {}
) {
    const { email, pin } = CREDS[role];
    const timeout = options.timeout ?? 25_000;

    await page.goto('/login', { waitUntil: 'networkidle' });

    // Rellenar formulario
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pin);
    await page.click('button[type="submit"]');

    // Esperar redirección — NextAuth + AuthContext refresh
    if (options.expectRedirect) {
        await page.waitForURL(`**${options.expectRedirect}**`, { timeout });
    } else {
        // Por defecto esperamos que salga del /login
        await page.waitForFunction(
            () => !window.location.pathname.startsWith('/login'),
            { timeout }
        );
    }
}

// ── Login con credenciales incorrectas (espera error) ─────────────────────
export async function loginWithBadCredentials(page: Page, email: string, pin: string) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pin);
    await page.click('button[type="submit"]');
    // Esperar que aparezca mensaje de error en la página
    await page.waitForTimeout(3000);
}

// ── Logout (limpia session cookies) ───────────────────────────────────────
export async function logout(page: Page) {
    await page.goto('/api/auth/signout', { waitUntil: 'networkidle' });
    // El formulario de signout de NextAuth
    const btn = page.locator('button[type="submit"]');
    if (await btn.isVisible()) await btn.click();
    await page.waitForTimeout(1000);
}
