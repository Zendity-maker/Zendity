import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { NextAuthProvider } from "@/components/NextAuthProvider";
import AppLayout from "@/components/AppLayout";
import ZendiSpeaker from "@/components/care/zendi/ZendiSpeaker";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
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
  { name: 'Insights', href: '/', icon: '📊' },
  { name: 'Preingreso', href: '/preingreso', icon: '📝' },
  { name: 'Med (eMAR)', href: '/med', icon: '💊' },
  { name: 'Audit & Incidents', href: '/audit', icon: '📁' },
  { name: 'Academy', href: '/academy', icon: '🎓' },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${outfit.variable} ${plusJakartaSans.variable} antialiased bg-gray-50 text-gray-900 flex min-h-screen font-sans`}
      >
        <NextAuthProvider>
          <AuthProvider>
            <AppLayout>
              <ZendiSpeaker />
              {children}
            </AppLayout>
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
