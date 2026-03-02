import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { NextAuthProvider } from "@/components/NextAuthProvider";
import AppLayout from "@/components/AppLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zendity - Healthcare Dashboard",
  description: "Plataforma multitenant para hogares de envejecientes.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 flex h-screen overflow-hidden`}
      >
        <NextAuthProvider>
          <AuthProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </AuthProvider>
        </NextAuthProvider>
      </body>
    </html >
  );
}
