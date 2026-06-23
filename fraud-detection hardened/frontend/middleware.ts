// frontend/middleware.ts — Next.js edge middleware: server-side route protection
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/favicon.ico', '/']);

function isPublicAsset(pathname: string): boolean {
  return pathname.startsWith('/_next/') ||
         pathname.startsWith('/api/') ||
         pathname.startsWith('/static/') ||
         pathname.endsWith('.ico') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.svg');
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for now to debug 404 error
  if (isPublicAsset(pathname)) return NextResponse.next();
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
