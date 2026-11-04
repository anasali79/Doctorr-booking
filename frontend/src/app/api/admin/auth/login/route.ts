import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import { SESSION_COOKIE_NAME } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendRes = await apiFetch<{
      message: string;
      user: { id: string; name: string; email: string; role: string };
      token: string;
    }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
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

    // Store admin_token, token, and SESSION_COOKIE_NAME
    response.cookies.set({
      ...cookieOptions,
      name: 'admin_token',
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

    return response;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message, error: error.data },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : 'Admin authentication failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}

