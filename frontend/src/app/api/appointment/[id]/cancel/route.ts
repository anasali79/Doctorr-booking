import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, user } = await getSession();
    if (!token || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    let body: any = undefined;
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // If role is DOCTOR, use doctor endpoint, else patient endpoint
    const endpoint =
      user.role === 'DOCTOR'
        ? `/api/doctor/appointments/${id}/cancel`
        : `/api/appointment/${id}/cancel`;

    const res = await apiFetch(endpoint, {
      method: 'PATCH',
      token,
      body,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to cancel appointment' },
      { status: 500 },
    );
  }
}
