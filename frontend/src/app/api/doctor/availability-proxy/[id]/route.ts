import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, user } = await getSession();
    if (!token || !user || user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const res = await apiFetch(`/api/doctor/availability/${id}`, {
      method: 'DELETE',
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, user } = await getSession();
    if (!token || !user || user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const res = await apiFetch(`/api/doctor/availability/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
