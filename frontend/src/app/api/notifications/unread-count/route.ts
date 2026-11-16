import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { token } = await getSession();
    if (!token) {
      return NextResponse.json({ unreadCount: 0, data: { unreadCount: 0 } });
    }

    const res = await apiFetch<any>('/api/notifications/unread-count', {
      token,
    });

    const unreadCount = res?.data?.unreadCount ?? res?.unreadCount ?? 0;

    return NextResponse.json({
      success: true,
      unreadCount,
      data: {
        unreadCount,
      },
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ unreadCount: 0, data: { unreadCount: 0 } });
  }
}
