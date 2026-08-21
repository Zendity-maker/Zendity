/**
 * Avisos por correo a familias — sin PHI.
 *
 * Regla del proyecto (CLAUDE.md): el cuerpo del correo NO lleva diagnósticos,
 * medicamentos ni datos clínicos identificables. Sí puede decir "tienes una
 * notificación, entra a app.zendity.com".
 *
 * Auditoría del 21-ago-2026: cuatro envíos la estaban rompiendo. El correo es
 * un canal sin cifrar que queda en servidores de terceros, se reenvía y se lee
 * en pantallas ajenas — así que aquí tampoco va el NOMBRE del residente.
 *
 * Un asunto como "Plan de Atención de Fulano — Aprobado" ya revela que esa
 * persona está bajo plan clínico, sin necesidad de abrir nada. Lo mismo
 * "Hospicio X visitó a Fulano": el proveedor es el diagnóstico.
 *
 * El contenido vive en el portal, detrás de autenticación. El correo solo
 * avisa que hay algo nuevo.
 */

export interface AvisoFamilia {
    /** Nombre del familiar. Es el destinatario, no el residente. */
    familyName?: string | null;
    hqName: string;
    /** Qué tipo de novedad hay. Sin nombres ni contenido clínico. */
    titulo: string;
    /** Una línea de contexto, también sin PHI. */
    detalle: string;
    /** Ruta del portal donde está el contenido real. */
    ruta?: string;
}

export interface CorreoListo {
    subject: string;
    html: string;
    text: string;
}

export function avisoFamiliaSinPHI({
    familyName,
    hqName,
    titulo,
    detalle,
    ruta = '/family/feed',
}: AvisoFamilia): CorreoListo {
    const url = `https://app.zendity.com${ruta}`;
    const saludo = familyName ? `Hola ${familyName},` : 'Hola,';

    const text =
        `${saludo}\n\n${detalle}\n\nEntra a ${url} para verlo.\n\n` +
        `Por su privacidad, los detalles no se envían por correo.\n\n— Equipo Zéndity`;

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="background:#0F6E56;padding:24px 32px;">
      <div style="color:#fff;font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;opacity:.85;">Zéndity</div>
      <div style="color:#fff;font-size:20px;font-weight:900;margin-top:4px;">${titulo}</div>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0F172A;">${saludo}</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">${detalle}</p>
      <div style="text-align:center;margin:8px 0 24px;">
        <a href="${url}" style="background:#0F6E56;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          Ver en el portal
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;line-height:1.5;">
        Por su privacidad, los detalles no se envían por correo.<br>Están en el portal, protegidos con su acceso.
      </p>
    </div>
    <div style="background:#F8FAFC;padding:14px 32px;border-top:1px solid #E2E8F0;text-align:center;">
      <p style="margin:0;color:#94A3B8;font-size:11px;">${hqName} · Zéndity</p>
    </div>
  </div>
</body></html>`;

    return { subject: `${titulo} · Zéndity`, html, text };
}
