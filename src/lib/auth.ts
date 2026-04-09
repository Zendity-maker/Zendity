import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from '@/lib/prisma';



export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Zendity OS",
            credentials: {
                email: { label: "Identificación de Usuario", type: "text" },
                pinCode: { label: "PIN Clínico de Acceso", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.pinCode) {
                    throw new Error("Debe ingresar un Email y PIN válidos.");
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                    include: { headquarters: true },
                });

                if (user) {
                    if (user.pinCode !== credentials.pinCode) {
                        throw new Error(" Acceso Denegado. PIN Clínico Inválido.");
                    }
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        secondaryRoles: user.secondaryRoles || [],
                        headquartersId: user.headquartersId,
                        headquartersName: user.headquarters.name,
                        photoUrl: user.photoUrl || user.image || null,
                    } as any;
                }

                const family = await prisma.familyMember.findUnique({
                    where: { email: credentials.email },
                    include: { headquarters: true }
                });

                if (family) {
                    if (family.passcode !== credentials.pinCode) {
                        throw new Error(" Acceso Denegado. PIN Familiar Inválido.");
                    }
                    return {
                        id: family.patientId,
                        name: family.name,
                        email: family.email,
                        role: "FAMILY",
                        headquartersId: family.headquartersId,
                        headquartersName: family.headquarters.name,
                    } as any;
                }

                throw new Error(" Acceso Denegado. Credenciales no encontradas.");
            },
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.name = user.name;
                token.role = (user as any).role;
                token.headquartersId = (user as any).headquartersId;
                token.photoUrl = (user as any).photoUrl || null;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.name = token.name as string;
                session.user.role = token.role as string;
                session.user.headquartersId = token.headquartersId as string;
                (session.user as any).photoUrl = token.photoUrl || null;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // 8 horas en lugar de 30 días
    },
    secret: process.env.NEXTAUTH_SECRET || "ZenditySecretKey123!Secure!2026",
};
