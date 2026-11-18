import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET(req: NextRequest) {
  try {
    const { token, user } = await getSession();
    if (!token || !user || user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get('doctorId');
    const query = doctorId ? `?doctorId=${encodeURIComponent(doctorId)}` : '';

    const res = await apiFetch(`/api/receptionist/appointments${query}`, { token });
    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch receptionist appointments' },
      { status: 500 },
    );
  }
}
