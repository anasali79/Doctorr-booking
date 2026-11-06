import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import { resetPasswordSchema } from '@/lib/schemas/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;

    if (!token) {
      return NextResponse.json(
        { error: 'Password reset token is required' },
        { status: 400 },
      );
    }

    const validated = resetPasswordSchema.parse({
      password: body?.password,
      confirmPassword: body?.confirmPassword,
    });

    const backendRes = await apiFetch<{
      message: string;
    }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        newPassword: validated.password,
      }),
    });

    return NextResponse.json({
      success: true,
      message: backendRes.message,
    });
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
      { error: error?.message || 'Failed to reset password' },
      { status: 500 },
    );
  }
}

