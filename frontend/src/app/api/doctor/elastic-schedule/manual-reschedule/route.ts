import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function POST(req: NextRequest) {
  try {
    const { token, user } = await getSession();
    if (!token || !user || user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const res = await apiFetch('/api/doctor/elastic-schedule/manual-reschedule', {
      method: 'POST',
      body,
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, data: error.data }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}

