import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET() {
  try {
    const { token, user } = await getSession();

    if (!token || !user) {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    }

    if (user.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Only patients have appointments' }, { status: 403 });
    }

    const backendRes = await apiFetch<{
      message?: string;
      data: any[];
    }>('/api/appointment/my', {
      method: 'GET',
      token,
    });

    return NextResponse.json(backendRes);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch appointments' },
      { status: 500 },
    );
  }
}

