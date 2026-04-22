import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
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

                // select explícito — evitar descargar todo el row (relaciones,
                // arrays grandes, campos binarios) en cada intento de login.
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        secondaryRoles: true,
                        headquartersId: true,
                        pinCode: true,
                        complianceScore: true,
                        photoUrl: true,
                        isActive: true,
                        isDeleted: true,
                        isShiftBlocked: true,
                    }
                });

                if (user) {
                    if (!user.isActive || user.isDeleted) {
                        throw new Error("Acceso Denegado. Cuenta inactiva.");
                    }
                    if (user.pinCode !== credentials.pinCode) {
                        throw new Error("Acceso Denegado. PIN Clinico Invalido.");
                    }
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        headquartersId: user.headquartersId,
                    };
                }

                const family = await prisma.familyMember.findUnique({
                    where: { email: credentials.email },
                });

                if (family) {
                    if (family.passcode !== credentials.pinCode) {
                        throw new Error("Acceso Denegado. PIN Familiar Invalido.");
                    }
                    return {
                        id: family.id,
                        name: family.name,
                        email: family.email,
                        role: "FAMILY",
                        headquartersId: family.headquartersId,
                    };
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
                token.uid = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            const dbUser = await prisma.user.findUnique({
                where: { id: token.uid as string },
                select: { id: true, name: true, email: true, role: true, headquartersId: true, photoUrl: true, secondaryRoles: true, complianceScore: true }
            });
            if (dbUser) {
                session.user.id = dbUser.id;
                session.user.name = dbUser.name;
                session.user.email = dbUser.email;
                session.user.role = dbUser.role;
                session.user.headquartersId = dbUser.headquartersId;
                session.user.photoUrl = dbUser.photoUrl;
                session.user.secondaryRoles = dbUser.secondaryRoles ?? [];
                (session.user as any).complianceScore = dbUser.complianceScore;
            } else {
                // Intentar como familia
                const family = await prisma.familyMember.findUnique({
                    where: { id: token.uid as string },
                    select: { id: true, name: true, email: true, patientId: true, headquartersId: true }
                });
                if (family) {
                    session.user.id = family.patientId;
                    session.user.name = family.name;
                    session.user.email = family.email;
                    session.user.role = "FAMILY";
                    session.user.headquartersId = family.headquartersId;
                    session.user.photoUrl = null;
                }
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET!,
};
