import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import { forgotPasswordSchema } from '@/lib/schemas/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = forgotPasswordSchema.parse(body);

    const backendRes = await apiFetch<{
      message: string;
    }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(validated),
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
      { error: error?.message || 'Failed to process forgot password request' },
      { status: 500 },
    );
  }
}
