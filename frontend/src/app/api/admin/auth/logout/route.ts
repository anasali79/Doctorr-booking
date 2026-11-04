import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/constants';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Admin logged out successfully',
  });

  const cookieOptions = {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };

  response.cookies.set({ ...cookieOptions, name: 'admin_token', value: '' });
  response.cookies.set({ ...cookieOptions, name: 'token', value: '' });
  response.cookies.set({ ...cookieOptions, name: 'jwt', value: '' });
  response.cookies.set({ ...cookieOptions, name: SESSION_COOKIE_NAME, value: '' });

  return response;
}

