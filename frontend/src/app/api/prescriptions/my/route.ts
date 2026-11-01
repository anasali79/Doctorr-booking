import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET() {
  try {
    const { token, user } = await getSession();
    if (!token || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const endpoint =
      user.role === 'DOCTOR'
        ? '/api/prescriptions/doctor-prescriptions'
        : '/api/prescriptions/my-prescriptions';

    const res = await apiFetch(endpoint, {
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError || error?.status) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch prescriptions' },
        { status: error.status || 500 },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
