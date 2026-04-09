import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Limpiar cookies fragmentadas viejas de NextAuth que causan error 494
  const cookieNames = [...request.cookies.getAll().map(c => c.name)]
  const fragmentedCookies = cookieNames.filter(name =>
    name.includes('next-auth.session-token.') && name.match(/\.\d+$/)
  )

  if (fragmentedCookies.length > 0) {
    fragmentedCookies.forEach(cookieName => {
      response.cookies.delete(cookieName)
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
