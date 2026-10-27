import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwt } from 'jose';
import { SESSION_COOKIE_NAME } from '@/lib/constants';
import { SessionUser } from '@/types';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token =
    request.cookies.get('token')?.value ||
    request.cookies.get('jwt')?.value ||
    request.cookies.get(SESSION_COOKIE_NAME)?.value;

  let session: SessionUser | null = null;
  if (token) {
    try {
      const decoded = decodeJwt(token) as Record<string, any>;
      if (decoded && (!decoded.exp || decoded.exp * 1000 > Date.now())) {
        const userId = decoded.sub || decoded.id;
        if (userId && decoded.role) {
          session = {
            id: userId,
            email: decoded.email || '',
            role: decoded.role,
            exp: decoded.exp,
          };
        }
      }
    } catch {
      session = null;
    }
  }

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isDoctorRoute = pathname.startsWith('/doctor');
  const isPatientRoute = pathname.startsWith('/patient');

  // If logged in and visiting login or signup, redirect to respective dashboard
  if (isAuthPage && session) {
    const dest = session.role === 'DOCTOR' ? '/doctor/dashboard' : '/patient/dashboard';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // If not logged in and accessing protected routes
  if ((isDoctorRoute || isPatientRoute) && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role mismatch checks
  if (session) {
    if (isDoctorRoute && session.role !== 'DOCTOR') {
      return NextResponse.redirect(new URL('/patient/dashboard', request.url));
    }
    if (isPatientRoute && session.role !== 'PATIENT') {
      return NextResponse.redirect(new URL('/doctor/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/patient/:path*', '/doctor/:path*', '/login', '/signup'],
};
