import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, user } = await getSession();
    if (!token || !user || user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const res = await apiFetch(`/api/doctor/availability/override/check-delete/${id}`, {
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      const data = error.data && typeof error.data === 'object' ? error.data : {};
      return NextResponse.json({ error: error.message, ...data }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to check custom override' },
      { status: 500 },
    );
  }
}

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
    const confirmCancelAndRefund = req.nextUrl.searchParams.get('confirmCancelAndRefund');
    const query = confirmCancelAndRefund ? `?confirmCancelAndRefund=${confirmCancelAndRefund}` : '';

    const res = await apiFetch(`/api/doctor/availability/override/${id}${query}`, {
      method: 'DELETE',
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      const data = error.data && typeof error.data === 'object' ? error.data : {};
      return NextResponse.json({ error: error.message, ...data }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to delete custom override' },
      { status: 500 },
    );
  }
}

