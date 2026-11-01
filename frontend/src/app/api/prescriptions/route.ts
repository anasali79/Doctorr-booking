import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function POST(req: NextRequest) {
  try {
    const { token, user } = await getSession();
    if (!token || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DOCTOR') {
      return NextResponse.json(
        { error: 'Forbidden: Only doctors can issue prescriptions' },
        { status: 403 },
      );
    }

    const body = await req.json();

    if (!body.appointmentId) {
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 },
      );
    }

    if (!body.diagnosis || !body.diagnosis.trim()) {
      return NextResponse.json(
        { error: 'Clinical diagnosis is required' },
        { status: 400 },
      );
    }

    const res = await apiFetch('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError || error?.status) {
      return NextResponse.json(
        { error: error.message || 'Failed to save prescription' },
        { status: error.status || 500 },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
