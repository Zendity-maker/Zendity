// Sprint email-logo (jul-2026).
// Devuelve una URL de logo APTA PARA CORREO a partir del Headquarters.logoUrl.
//
// Problema: los logos se guardan como data-URI base64 en la BD. En el navegador
// (app) se ven bien, pero los clientes de correo bloquean imágenes `data:` →
// círculo gris de imagen rota.
//
// Solución: si el logo es data-URI, apuntamos al endpoint público
// /api/hq/[id]/logo que lo sirve como image/png real. Si ya es una URL http(s),
// se usa tal cual. Si no hay logo, devuelve null (el caller cae a texto).
export function emailLogoSrc(hqId?: string | null, logoUrl?: string | null): string | null {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('http')) return logoUrl; // ya es pública
    if (!hqId) return null; // data-URI sin hqId → no podemos servirla; caller cae a texto
    const base = (process.env.NEXTAUTH_URL || 'https://app.zendity.com').replace(/\/+$/, '');
    return `${base}/api/hq/${hqId}/logo`;
}
