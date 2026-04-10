import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value.substring(0, 100)
  })
  console.log('ALL HEADERS:', JSON.stringify(headers))
  console.log('TOTAL HEADER SIZE:', JSON.stringify(headers).length)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
