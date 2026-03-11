import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
                        throw new Error("⚠️ Acceso Denegado. PIN Clínico Inválido.");
                    }
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        secondaryRoles: user.secondaryRoles || [],
                        headquartersId: user.headquartersId,
                        headquartersName: user.headquarters.name,
                    } as any;
                }

                const family = await prisma.familyMember.findUnique({
                    where: { email: credentials.email },
                    include: { headquarters: true }
                });

                if (family) {
                    if (family.passcode !== credentials.pinCode) {
                        throw new Error("⚠️ Acceso Denegado. PIN Familiar Inválido.");
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

                throw new Error("⚠️ Acceso Denegado. Credenciales no encontradas.");
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
                token.role = (user as any).role;
                token.secondaryRoles = (user as any).secondaryRoles || [];
                token.headquartersId = (user as any).headquartersId;
                token.headquartersName = (user as any).headquartersName;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.secondaryRoles = (token.secondaryRoles as string[]) || [];
                session.user.headquartersId = token.headquartersId as string;
                session.user.headquartersName = token.headquartersName as string;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET || "ZenditySecretKey123!Secure!2026",
};
