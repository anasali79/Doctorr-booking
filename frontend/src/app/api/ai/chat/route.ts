import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { token, user } = await getSession();
    if (!token || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in to use the AI Assistant' },
        { status: 401 },
      );
    }

    const body = await req.json();

    const res = await apiFetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      token,
      timeout: 60000,
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
      error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
