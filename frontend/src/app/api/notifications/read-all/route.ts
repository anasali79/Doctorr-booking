import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function PATCH() {
  try {
    const { token } = await getSession();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await apiFetch('/api/notifications/read-all', {
      method: 'PATCH',
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
