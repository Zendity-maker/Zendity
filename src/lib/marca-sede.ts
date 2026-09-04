import { prisma } from '@/lib/prisma';

/**
 * MARCA DE LA SEDE EN LOS CORREOS A FAMILIA
 * ─────────────────────────────────────────
 * Un familiar recibe estos correos del hogar donde vive su ser querido, no de
 * un proveedor de software. Hasta sep-2026 el remitente decía "Zéndity" y el
 * encabezado era de Zéndity: la familia no reconocía de quién le llegaba.
 *
 * Regla acordada con Andrés el 03-sep-2026: el nombre de la sede grande —con
 * Cupey o Mayagüez, porque la familia sabe a cuál pertenece su residente—, los
 * colores de la sede, y Zéndity pequeño al pie como lo que es: la parte que los
 * conecta con el hogar.
 *
 * El remitente lleva el nombre de la sede porque es lo único que el familiar ve
 * en su bandeja ANTES de abrir. Un correo que dice "Zéndity" se abre con menos
 * confianza que uno que dice "Vivid Senior Living Cupey".
 */

/** Paleta por defecto si la sede no configuró la suya. */
const DEFAULT = {
    primary: '#0F6E56',
    secondary: '#1D9E75',
    accent: '#1D9E75',
    bg: '#FAFAF9',
};

export interface MarcaSede {
    /** "Vivid Senior Living Cupey" — lo que ve la familia. */
    nombre: string;
    /** Nombre comercial corto si lo hay: "Vivid". */
    marca: string;
    logoUrl: string | null;
    primary: string;
    secondary: string;
    /** Color de la acción positiva. Verde en Vivid. */
    accent: string;
    bg: string;
    /** Para el campo `from` de SendGrid. */
    remitente: { name: string; email: string };
}

export async function marcaSede(hqId: string): Promise<MarcaSede> {
    const hq = await prisma.headquarters.findUnique({
        where: { id: hqId },
        select: {
            name: true, brandName: true, logoUrl: true,
            brandPrimary: true, brandSecondary: true, brandAccent: true, brandBg: true,
        },
    });

    const nombre = hq?.name ?? 'Zéndity';
    return {
        nombre,
        marca: hq?.brandName ?? nombre,
        logoUrl: hq?.logoUrl ?? null,
        primary: hq?.brandPrimary ?? DEFAULT.primary,
        secondary: hq?.brandSecondary ?? DEFAULT.secondary,
        // `brandAccent` existía en el modelo desde siempre —el verde de Vivid,
        // #C5E69A— y este selector no lo pedía. Es el color de la acción
        // positiva; sin él, el kiosco no tenía con qué pintar el botón que
        // continúa y acababa usando el teal de Zéndity.
        accent: hq?.brandAccent ?? DEFAULT.accent,
        bg: hq?.brandBg ?? DEFAULT.bg,
        remitente: {
            // El nombre de la sede es lo que se ve en la bandeja.
            name: nombre,
            email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
        },
    };
}

/**
 * Encabezado: la sede al frente, grande.
 * Con logo lo usa; sin logo, el nombre en la tipografía de la marca.
 */
export function encabezadoSede(m: MarcaSede): string {
    const logo = m.logoUrl
        ? `<img src="${m.logoUrl}" alt="${m.nombre}" style="max-height:56px;object-fit:contain;display:block;margin:0 auto 10px;" />`
        : '';
    return `
<div style="background:${m.bg};padding:26px 24px 22px;text-align:center;border-bottom:3px solid ${m.primary};">
    ${logo}
    <p style="margin:0;font-size:21px;font-weight:800;color:${m.primary};letter-spacing:-0.3px;line-height:1.25;">
        ${m.nombre}
    </p>
</div>`;
}

/**
 * Pie: Zéndity pequeño, explicando qué es.
 * No se esconde —la familia debe saber por dónde le llega la información— pero
 * no compite con el nombre del hogar.
 */
export function pieSede(m: MarcaSede): string {
    return `
<div style="padding:18px 24px 22px;text-align:center;border-top:1px solid #e7e5e4;">
    <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.6;">
        Recibes este mensaje de <strong style="color:#78716c;">${m.nombre}</strong>.<br>
        Enviado a través de <strong style="color:#78716c;">Zéndity</strong>, la plataforma que conecta
        al hogar con su familia.
    </p>
</div>`;
}

/** Envuelve un cuerpo HTML con el encabezado y el pie de la sede. */
export function correoDeSede(m: MarcaSede, cuerpoHtml: string): string {
    return `<div style="max-width:620px;margin:0 auto;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${encabezadoSede(m)}
<div style="padding:26px 24px;color:#12211D;line-height:1.65;font-size:15px;">
${cuerpoHtml}
</div>
${pieSede(m)}
</div>`;
}
