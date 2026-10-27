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
      body: JSON.stringify(validated),
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid reschedule data' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to reschedule appointment' },
      { status: 500 },
    );
  }
}
