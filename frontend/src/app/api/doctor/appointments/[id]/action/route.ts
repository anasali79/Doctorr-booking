import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, user } = await getSession();
    if (!token || !user || user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    const validActions = ['manual-check-in', 'start-consultation', 'complete', 'no-show'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid consultation action' }, { status: 400 });
    }

    const res = await apiFetch(`/api/appointments/${id}/${action}`, {
      method: 'POST',
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || 'Action failed' }, { status: 500 });
  }
}
