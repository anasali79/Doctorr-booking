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
    if (!token || !user || user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized: Doctor access only' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = rescheduleSchema.parse(body);

    const res = await apiFetch(`/api/doctor/appointments/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({
        date: validated.date,
        startTime: validated.startTime,
        endTime: validated.endTime,
        reason: (body as any)?.reason || (body as any)?.rescheduleReason,
        rescheduleReason: (body as any)?.rescheduleReason || (body as any)?.reason,
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

