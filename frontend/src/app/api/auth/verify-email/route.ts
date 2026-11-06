import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 },
      );
    }

    const backendRes = await apiFetch<{
      message: string;
      email?: string;
    }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });

    return NextResponse.json({
      success: true,
      message: backendRes.message,
      email: backendRes.email,
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Email verification failed' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 },
      );
    }

    const backendRes = await apiFetch<{
      message: string;
      email?: string;
    }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    return NextResponse.json({
      success: true,
      message: backendRes.message,
      email: backendRes.email,
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Email verification failed' },
      { status: 500 },
    );
  }
}

