import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ActiveHqProvider } from "@/contexts/ActiveHqContext";
import { NextAuthProvider } from "@/components/NextAuthProvider";
import BillingGuard from "@/components/BillingGuard";
import AppLayout from "@/components/AppLayout";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

// Serif de lectura para Zendity Academy. La Academia acredita profesionalmente
// y debe leerse como institución educativa, no como otro módulo de la app;
// `font-serif` sin fuente propia caía al Times del sistema, distinto en cada
// máquina. Solo se usa en /academy.
const sourceSerif = Source_Serif_4({
  variable: "--font-serif-academy",
  subsets: ["latin"],
  display: "swap",
});

import { Viewport } from "next";

export const metadata: Metadata = {
  title: "Zendity - Healthcare Dashboard",
  description: "Plataforma multitenant para hogares de envejecientes.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zendity"
  }
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const navigation = [
  { name: 'Insights', href: '/', icon: '' },
  { name: 'Preingreso', href: '/preingreso', icon: '' },
  { name: 'Med (eMAR)', href: '/med', icon: '' },
  { name: 'Audit & Incidents', href: '/audit', icon: '' },
  // { name: 'Academy', href: '/academy', icon: '' }, // PILOTO 2: SOMBRA
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${outfit.variable} ${plusJakartaSans.variable} ${sourceSerif.variable} antialiased bg-gray-50 text-gray-900 flex min-h-screen font-sans`}
      >
        <NextAuthProvider>
          <AuthProvider>
            <ActiveHqProvider>
              <AppLayout>
                {/* El altavoz de anuncios se retiro con el boton de voz: era su
                    UNICO productor. Consultaba /api/ai/announcements cada 8
                    segundos en cada tableta abierta —unas 10.800 peticiones al
                    dia por dispositivo— para una funcion con CERO registros en
                    la historia del sistema. */}
                <BillingGuard />
                {children}
              </AppLayout>
            </ActiveHqProvider>
          </AuthProvider>
        </NextAuthProvider>

        {/* PWA Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  // Destruir cualquier Service Worker viejo atascado en PWA para forzar refresco
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                      registration.unregister();
                      console.log('ServiceWorker DEAD: Cache Busted');
                    }
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html >
  );
}
