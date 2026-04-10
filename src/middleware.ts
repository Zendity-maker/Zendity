import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const cookies = request.cookies.getAll()
  const cookieHeader = request.headers.get('cookie') || ''

  console.log('COOKIE COUNT:', cookies.length)
  console.log('COOKIE HEADER SIZE:', cookieHeader.length, 'bytes')
  console.log('COOKIE NAMES:', cookies.map(c => c.name).join(', '))

  const reqCookieHeader = request.headers.get('cookie') || ''
  console.log('REQUEST COOKIE HEADER BYTES:', Buffer.byteLength(reqCookieHeader, 'utf8'))

  const response = NextResponse.next()

  const fragmentedCookies = cookies.filter(c => c.name.match(/next-auth.*\.\d+$/))
  if (fragmentedCookies.length > 0) {
    console.log('DELETING FRAGMENTED:', fragmentedCookies.map(c => c.name).join(', '))
    fragmentedCookies.forEach(c => response.cookies.delete(c.name))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
