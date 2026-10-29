import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET(req: NextRequest) {
  try {
    const { token, user } = await getSession();

    if (!token || !user) {
      return NextResponse.json({ error: 'Please sign in to view payment history' }, { status: 401 });
    }

    if (user.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Only patients can view payment history' }, { status: 403 });
    }

    const backendRes = await apiFetch('/api/payment/history', {
      method: 'GET',
      token,
    });

    return NextResponse.json(backendRes);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch payment history' },
      { status: 500 },
    );
  }
}

