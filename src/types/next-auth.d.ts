import "next-auth"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface User {
        id: string
        role: string
        headquartersId: string
        photoUrl?: string | null
    }

    interface Session {
        user: {
            id: string
            role: string
            headquartersId: string
            photoUrl?: string | null
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        uid: string
    }
}
