import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isPublicPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/pricing' ||
    pathname === '/login' ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('dip_session')?.value;
  if (!token) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('from', pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
