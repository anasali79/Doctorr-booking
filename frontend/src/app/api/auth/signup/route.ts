import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import { SESSION_COOKIE_NAME } from '@/lib/constants';
import { signupSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = signupSchema.parse(body);

    const backendRes = await apiFetch<{
      message: string;
      requiresVerification?: boolean;
      user: { id: string; name: string; email: string; role: 'DOCTOR' | 'PATIENT' };
      token?: string;
    }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(validated),
    });

    const response = NextResponse.json({
      success: true,
      user: backendRes.user,
      requiresVerification: backendRes.requiresVerification ?? true,
      message: backendRes.message,
    });

    // If backend returns a token (e.g. if email verification is bypassed/turned off), set cookies
    if (backendRes.token) {
      const cookieOptions = {
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
      };

      response.cookies.set({
        ...cookieOptions,
        name: 'jwt',
        value: backendRes.token,
        httpOnly: false,
      });

      response.cookies.set({
        ...cookieOptions,
        name: 'token',
        value: backendRes.token,
        httpOnly: false,
      });

      response.cookies.set({
        ...cookieOptions,
        name: SESSION_COOKIE_NAME,
        value: backendRes.token,
        httpOnly: true,
      });
    }

    return response;
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: (error.data as any)?.code,
          email: (error.data as any)?.email,
        },
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
      { error: error?.message || 'Signup failed' },
      { status: 500 },
    );
  }
}
