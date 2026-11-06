import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import { resendVerificationSchema } from '@/lib/schemas/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = resendVerificationSchema.parse(body);

    const backendRes = await apiFetch<{
      message: string;
      alreadyVerified?: boolean;
    }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify(validated),
    });

    return NextResponse.json({
      success: true,
      message: backendRes.message,
      alreadyVerified: backendRes.alreadyVerified,
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
      { error: error?.message || 'Failed to resend verification email' },
      { status: 500 },
    );
  }
}

