import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';
import { rescheduleSchema } from '@/lib/schemas';

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
    const body = await req.json();
    const validated = rescheduleSchema.parse(body);

    const res = await apiFetch(`/api/appointment/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({
        date: validated.date,
        startTime: validated.startTime,
        endTime: validated.endTime,
      }),
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError || error?.status) {
      return NextResponse.json(
        { error: error.message || 'Reschedule failed' },
        { status: error.status || 500 },
      );
    }
    if (error.name === 'ZodError' || error.issues || error.errors) {
      const msg =
        error.issues?.[0]?.message ||
        error.errors?.[0]?.message ||
        'Invalid reschedule data';
      return NextResponse.json(
        { error: msg },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to reschedule appointment' },
      { status: 500 },
    );
  }
}
