import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';
import { recurringAvailabilitySchema } from '@/lib/schemas';

export async function GET() {
  try {
    const { token, user } = await getSession();
    if (!token || !user || user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await apiFetch('/api/doctor/availability', { token });
    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, user } = await getSession();
    if (!token || !user || user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = recurringAvailabilitySchema.parse(body);

    const res = await apiFetch('/api/doctor/availability', {
      method: 'POST',
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
        { error: error.errors[0]?.message || 'Invalid availability schedule' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
