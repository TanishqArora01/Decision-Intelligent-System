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
  
  // Allow public assets and public paths
  if (isPublicAsset(pathname)) return NextResponse.next();
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  
  // Check for authentication token
  const token = request.cookies.get('access_token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');
  
  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
