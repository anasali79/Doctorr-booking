import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { token, user } = await getSession();
    if (!token || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await apiFetch('/api/ai/conversations', {
      method: 'GET',
      token,
    });

    return NextResponse.json(res);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, data: error.data },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : 'Failed to fetch conversations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
