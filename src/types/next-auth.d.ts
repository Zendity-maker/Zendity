import "next-auth"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface User {
        id: string
        role: string
        headquartersId: string
        photoUrl?: string | null
        secondaryRoles?: string[]  // FASE 51: roles secundarios (ej. SUPERVISOR + CAREGIVER)
    }

    interface Session {
        user: {
            id: string
            role: string
            headquartersId: string
            photoUrl?: string | null
            secondaryRoles: string[]  // FASE 51: siempre array (vacío si no tiene)
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        uid: string
    }
}
