import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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

                // Normalización del email — Prisma `findUnique({ email })` es
                // case- y whitespace-sensitive. Sin esto, "MaDelVelez@Gmail.com"
                // o " madelvelez@gmail.com" (autocapitalización de teclado iOS,
                // espacios pegados al copiar) no encuentran el record aunque
                // la cuenta exista, y el usuario ve "Credenciales no
                // encontradas" sin causa aparente. Caso documentado: María
                // del Pilar Vélez no podía entrar a /family por esto.
                //
                // Audit previo confirma: 0 emails actuales en User/FamilyMember
                // tienen mayúsculas o espacios — la normalización en lookup
                // no rompe ninguna cuenta existente. Endpoints que crean
                // User/FamilyMember idealmente también deberían normalizar
                // en write para mantener la invariante; ese es follow-up.
                const normalizedEmail = credentials.email.trim().toLowerCase();

                // select explícito — evitar descargar todo el row (relaciones,
                // arrays grandes, campos binarios) en cada intento de login.
                const user = await prisma.user.findUnique({
                    where: { email: normalizedEmail },
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
                    // Soporte dual: hash bcrypt (nuevo) o texto plano (legacy, hasta migración)
                    const pinIsHashed = user.pinCode?.startsWith('$2');
                    const pinValid = pinIsHashed
                        ? await bcrypt.compare(credentials.pinCode, user.pinCode!)
                        : user.pinCode === credentials.pinCode;
                    if (!pinValid) {
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
                    where: { email: normalizedEmail },
                    include: { patient: { select: { status: true, name: true } } },
                });

                if (family) {
                    // Soporte dual: hash bcrypt (nuevo) o texto plano (legacy, hasta migración)
                    const passIsHashed = family.passcode?.startsWith('$2');
                    const passValid = family.passcode && (
                        passIsHashed
                            ? await bcrypt.compare(credentials.pinCode, family.passcode)
                            : family.passcode === credentials.pinCode
                    );
                    if (!passValid) {
                        throw new Error("Acceso Denegado. PIN Familiar Invalido.");
                    }

                    // FIX 2026-05-31: Política de duelo / egreso.
                    // Si el residente está DECEASED o DISCHARGED, el portal
                    // familiar cierra. El acceso ya no tiene sentido operativo
                    // (no hay nuevas notas, vitales, ni mensajes que mostrar)
                    // y mantener el portal abierto puede ser confuso o doloroso
                    // (UX congelada en el último día). Decisión de política:
                    // cierre inmediato. Recuperación de registros se hace por
                    // canal administrativo (no auto-servicio).
                    if (family.patient && !['ACTIVE', 'TEMPORARY_LEAVE'].includes(family.patient.status)) {
                        throw new Error('Acceso cerrado. Para consultas sobre el expediente, comuníquese con la administración de la sede.');
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
                    select: {
                        id: true, name: true, email: true, patientId: true, headquartersId: true,
                        patient: { select: { status: true } },
                    }
                });
                // Defensa runtime: si Victor (familiar) tiene JWT vigente en
                // su navegador pero su residente acaba de pasar a DECEASED/
                // DISCHARGED, el siguiente render de página debe devolver
                // sesión vacía → middleware/UI lo manda al login con el
                // mensaje de cierre. Sin esto, una sesión activa sobreviviría
                // hasta que expirara naturalmente (8h).
                if (family && family.patient && ['ACTIVE', 'TEMPORARY_LEAVE'].includes(family.patient.status)) {
                    session.user.id = family.patientId;
                    session.user.name = family.name;
                    session.user.email = family.email;
                    session.user.role = "FAMILY";
                    session.user.headquartersId = family.headquartersId;
                    session.user.photoUrl = null;
                }
                // Si family existe pero patient NO está activo, deliberadamente
                // NO populamos session.user.* — se retorna sesión sin role,
                // los endpoints /api/family/* devolverán 401.
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
