import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function POST(req: NextRequest) {
  try {
    const { token, user } = await getSession();

    if (!token || !user) {
      return NextResponse.json({ error: 'Please sign in to proceed with payment' }, { status: 401 });
    }

    if (user.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Only patients can initiate payments' }, { status: 403 });
    }

    const body = await req.json();

    const backendRes = await apiFetch('/api/payment/create-order', {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    });

    return NextResponse.json(backendRes);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to create payment order' },
      { status: 500 },
    );
  }
}

