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
                        // Estado de la sede: cerrarla tiene que significar algo.
                        headquarters: {
                            select: { name: true, isActive: true, subscriptionStatus: true },
                        },
                    }
                });

                if (user) {
                    if (!user.isActive || user.isDeleted) {
                        throw new Error("Acceso Denegado. Cuenta inactiva.");
                    }
                    // ── SEDE CERRADA ────────────────────────────────────────
                    // La accion CLOSE del super admin ponia isActive:false y
                    // subscriptionStatus:'CANCELED', y NADA lo leia en el login:
                    // el personal de una sede cerrada seguia entrando como si
                    // nada. Cerrar una sede tiene que significar algo.
                    //
                    // El mensaje nombra la sede y dice a quien acudir. Un
                    // "acceso denegado" seco ante un cierre administrativo hace
                    // que la cuidadora crea que perdio su cuenta.
                    //
                    // SUPER_ADMIN queda fuera de esta puerta a proposito: es
                    // quien tiene que poder entrar a exportar la informacion del
                    // hogar durante los 60 dias que promete el BAA.
                    const sedeCerrada =
                        user.headquarters &&
                        (user.headquarters.isActive === false ||
                         user.headquarters.subscriptionStatus === 'CANCELED');
                    if (sedeCerrada && user.role !== 'SUPER_ADMIN') {
                        throw new Error(
                            `${user.headquarters!.name} no tiene el servicio activo. ` +
                            `Comunicate con la direccion del hogar.`
                        );
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
                select: { id: true, name: true, email: true, role: true, headquartersId: true, photoUrl: true, secondaryRoles: true, complianceScore: true, isActive: true, isDeleted: true }
            });
            /**
             * LA MISMA DEFENSA QUE LA FAMILIA TIENE ABAJO, QUE AL PERSONAL LE
             * FALTABA.
             *
             * `authorize` bloquea el LOGIN de una cuenta cerrada, pero la
             * estrategia es JWT con maxAge de 8 h: quien ya tenía el token en
             * el navegador seguía navegando hasta que caducara. Cerrar la
             * cuenta a las nueve de la mañana no la cerraba hasta las cinco.
             *
             * Y no había ningún corte real detrás: `hr/staff/[id]` hacía
             * `tx.session.deleteMany` creyendo que cortaba el acceso, pero con
             * estrategia JWT y sin adapter NextAuth no escribe ni una fila en
             * `Session` — medido: 0 filas en toda la producción. Esa línea
             * borraba 0 de 0, y los otros dos caminos de baja ni lo intentaban.
             *
             * Sin poblar `session.user.*` la sesión vuelve sin `role`, que es
             * exactamente lo que ya se hace catorce líneas más abajo cuando el
             * residente de un familiar pasa a DECEASED o DISCHARGED. La defensa
             * estaba escrita, solo que para el otro lado de la casa.
             */
            if (dbUser && (dbUser.isActive === false || dbUser.isDeleted === true)) {
                return session;
            }
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
        /**
         * OCHO HORAS ES EXACTAMENTE UN TURNO, Y ESE ES EL PROBLEMA.
         *
         * Medido el 29-sep-2026 sobre 1.062 turnos cerrados de 120 días: la
         * mediana dura 7,69 h y el p75 7,97 h. O sea que el turno típico muere
         * JUSTO en el borde — basta entrar al sistema unos minutos antes de
         * abrir el turno para cruzarlo. Y 236 de los 1.062 (22 %) pasan de 8 h,
         * con las 18 de 18 cuidadoras teniendo al menos uno.
         *
         * Sin `updateAge`, next-auth solo vuelve a firmar el JWT cuando alguien
         * llama a `/api/auth/session`, y con el `SessionProvider` pelado que
         * había eso pasaba al montar y poco más. Una tableta abierta todo el
         * turno no lo llamaba NUNCA: a las 8 h de haber entrado, todo lo que
         * escribiera devolvía 401.
         *
         * El escalón cae donde debe. Turnos cerrados SIN relevo, por duración:
         *
         *     6–7 h ......... 0 de 81
         *     7–7,5 h ....... 0 de 61
         *     7,5–8 h ....... 1 de 355   (0,3 %)
         *     8–8,5 h ....... 3 de 115   (2,6 %)
         *     8,5–9 h ....... 7 de 20    (35 %)
         *     9–10 h ........ 5 de 12    (41,7 %)
         *
         * En total 70 de 236 por encima de 8 h contra 10 de 826 por debajo. Que
         * el 401 sea la causa de esos 70 es INFERIDO, no medido: un turno de
         * 12–24 h también se queda sin relevo porque lo cierra un supervisor.
         * Pero el corte está en la hora 8 y el tramo limpio de 7,5–8 h es del
         * 0,3 % contra el 37,5 % de 8,5–10 h.
         *
         * `updateAge` hace que el JWT se refresque cada vez que se consulta la
         * sesión y hayan pasado más de 30 min. Con el `refetchInterval` del
         * provider, una tableta en uso no caduca a mitad de turno.
         */
        maxAge: 8 * 60 * 60,
        updateAge: 30 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET!,
};
