import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as any,
    providers: [
        CredentialsProvider({
            name: "Zendity OS",
            credentials: {
                email: { label: "Identificacion de Usuario", type: "text" },
                pinCode: { label: "PIN Clinico de Acceso", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.pinCode) {
                    throw new Error("Debe ingresar un Email y PIN validos.");
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (user) {
                    if (user.pinCode !== credentials.pinCode) {
                        throw new Error("Acceso Denegado. PIN Clinico Invalido.");
                    }
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        r: user.role,
                        h: user.headquartersId,
                        p: user.photoUrl || null,
                    } as any;
                }

                const family = await prisma.familyMember.findUnique({
                    where: { email: credentials.email },
                });

                if (family) {
                    if (family.passcode !== credentials.pinCode) {
                        throw new Error("Acceso Denegado. PIN Familiar Invalido.");
                    }
                    return {
                        id: family.patientId,
                        name: family.name,
                        email: family.email,
                        r: "FAMILY",
                        h: family.headquartersId,
                    } as any;
                }

                throw new Error("Acceso Denegado. Credenciales no encontradas.");
            },
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.i = user.id;
                token.r = (user as any).r;
                token.h = (user as any).h;
                token.p = (user as any).p || null;
            }
            // Eliminar campos enormes inyectados por PrismaAdapter
            delete (token as any).picture;
            delete (token as any).image;
            delete (token as any).profile;
            delete (token as any).account;
            delete (token as any).user;

            console.log('JWT SIZE:', JSON.stringify(token).length, 'bytes');
            console.log('TOKEN KEYS:', Object.keys(token).join(', '));
            return token;
        },
        async session({ session, token }) {
            delete (token as any).picture;
            delete (token as any).image;
            if (session.user) {
                session.user.id = token.i as string;
                session.user.role = token.r as string;
                session.user.headquartersId = token.h as string;
                (session.user as any).photoUrl = token.p || null;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60,
    },
    cookies: {
        sessionToken: {
            name: '__Secure-next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax' as const,
                path: '/',
                secure: true,
                maxAge: 8 * 60 * 60
            }
        }
    },
    secret: process.env.NEXTAUTH_SECRET || "ZenditySecretKey123!Secure!2026",
};
