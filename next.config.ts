/** @type {import('next').NextConfig} */
import type { NextConfig } from 'next';

// ─── Content Security Policy ──────────────────────────────────────────────
// Nota: img-src incluye 'https:' porque:
//   1. /corporate/settings/integrations acepta logoUrl externo (HTTPS) del usuario
//   2. /med/page.tsx usa una textura de transparenttextures.com (background CSS)
// Las fotos en base64 (photoUrl, idCardUrl, medicalPlanUrl) quedan cubiertas por data:.
const cspDirectives = [
  "default-src 'self'",
  // Next.js necesita 'unsafe-eval' en dev y 'unsafe-inline' para su runtime sin nonces
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  // Tailwind inyecta estilos inline
  "style-src 'self' 'unsafe-inline'",
  // data: para base64 (fotos de residentes, tarjetas ID, plan médico)
  // blob: para html2canvas/jsPDF
  // https: para logos de sede configurados por el usuario
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // connect-src: APIs externas consumidas desde el cliente o el servidor
  "connect-src 'self' https://api.openai.com https://api.anthropic.com https://*.neon.tech https://*.vercel.app",
  // Refuerza X-Frame-Options: nadie puede incrustar Zéndity en un iframe
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Bloquea mixed content en HTTPS
  "upgrade-insecure-requests",
].join('; ');

const buildSecurityHeaders = (permissionsPolicy: string) => [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: permissionsPolicy },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Content-Security-Policy', value: cspDirectives },
];

// Política default: bloquea cámara, micrófono y geolocalización
const DEFAULT_PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=()';
// Política /reception: el Kiosco usa Web Speech API (micrófono) — solo el propio origen
const RECEPTION_PERMISSIONS_POLICY = 'camera=(), microphone=(self), geolocation=()';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  async headers() {
    return [
      // Rutas /reception y subrutas → permiten micrófono del propio origen
      {
        source: '/reception/:path*',
        headers: buildSecurityHeaders(RECEPTION_PERMISSIONS_POLICY),
      },
      {
        source: '/reception',
        headers: buildSecurityHeaders(RECEPTION_PERMISSIONS_POLICY),
      },
      // Resto de rutas (excluye /reception mediante negative lookahead) → micrófono bloqueado
      {
        source: '/((?!reception).*)',
        headers: buildSecurityHeaders(DEFAULT_PERMISSIONS_POLICY),
      },
    ];
  },
};

export default nextConfig;
