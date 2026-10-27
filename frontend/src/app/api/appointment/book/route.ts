import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';
import { bookingSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  try {
    const { token, user } = await getSession();

    if (!token || !user) {
      return NextResponse.json({ error: 'Please sign in to book an appointment' }, { status: 401 });
    }

    if (user.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Only patients can book appointments' }, { status: 403 });
    }

    const body = await req.json();
    const validated = bookingSchema.parse(body);

    const backendRes = await apiFetch('/api/appointment', {
      method: 'POST',
      body: JSON.stringify(validated),
      token,
    });

    return NextResponse.json(backendRes);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'ZodError' || error.issues) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Invalid booking data';
      return NextResponse.json(
        { error: msg },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to book appointment' },
      { status: 500 },
    );
  }
}
