import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const cookies = request.cookies.getAll()
  const response = NextResponse.next()

  // Detectar y eliminar cookies fragmentadas de NextAuth (ambos prefijos)
  const fragmentedCookies = cookies.filter(c =>
    (c.name.includes('next-auth.session-token.') ||
     c.name.includes('__Host-next-auth') ||
     c.name.includes('__Secure-next-auth')) &&
    c.name.match(/\.\d+$/)
  )

  if (fragmentedCookies.length > 0) {
    console.log('DELETING FRAGMENTED:', fragmentedCookies.map(c => c.name).join(', '))
    fragmentedCookies.forEach(c => response.cookies.delete(c.name))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
