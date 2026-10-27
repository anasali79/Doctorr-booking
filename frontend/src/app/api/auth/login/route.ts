import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import { SESSION_COOKIE_NAME } from '@/lib/constants';
import { loginSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginSchema.parse(body);

    const backendRes = await apiFetch<{
      message: string;
      user: { id: string; name: string; email: string; role: 'DOCTOR' | 'PATIENT' };
      token: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(validated),
    });

    const response = NextResponse.json({
      success: true,
      user: backendRes.user,
      token: backendRes.token,
      message: backendRes.message,
    });

    const cookieOptions = {
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    };

    // 1. Store as 'jwt' cookie
    response.cookies.set({
      ...cookieOptions,
      name: 'jwt',
      value: backendRes.token,
      httpOnly: false,
    });

    // 2. Store as 'token' cookie (standard NestJS strategy & Socket header)
    response.cookies.set({
      ...cookieOptions,
      name: 'token',
      value: backendRes.token,
      httpOnly: false,
    });

    // 3. Store as 'access_token' (httpOnly Next.js session)
    response.cookies.set({
      ...cookieOptions,
      name: SESSION_COOKIE_NAME,
      value: backendRes.token,
      httpOnly: true,
    });

    return response;
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error.name === 'ZodError' || error.issues) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error';
      return NextResponse.json(
        { error: msg },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Login failed' },
      { status: 500 },
    );
  }
}
