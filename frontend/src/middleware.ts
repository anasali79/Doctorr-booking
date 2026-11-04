import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwt } from 'jose';
import { SESSION_COOKIE_NAME } from '@/lib/constants';
import { SessionUser } from '@/types';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token =
    request.cookies.get('token')?.value ||
    request.cookies.get('jwt')?.value ||
    request.cookies.get('admin_token')?.value ||
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

  const isAdminAuthPage = pathname === '/admin/login';
  const isAdminRoute = pathname.startsWith('/admin') && !isAdminAuthPage;
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isDoctorRoute = pathname.startsWith('/doctor');
  const isPatientRoute = pathname.startsWith('/patient');

  // Admin login page: if already logged in as ADMIN, redirect to admin dashboard
  if (isAdminAuthPage && session?.role === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // Protected Admin Routes: require session with role === 'ADMIN'
  if (isAdminRoute) {
    if (!session || session.role !== 'ADMIN') {
      const adminLoginUrl = new URL('/admin/login', request.url);
      adminLoginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(adminLoginUrl);
    }
    return NextResponse.next();
  }

  // If logged in and visiting user login or signup, redirect to respective dashboard
  if (isAuthPage && session) {
    if (session.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
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
      const dest = session.role === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    if (isPatientRoute && session.role !== 'PATIENT') {
      const dest = session.role === 'ADMIN' ? '/admin/dashboard' : '/doctor/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/patient/:path*', '/doctor/:path*', '/admin/:path*', '/login', '/signup'],
};
