import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, user } = await getSession();
    if (!token || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const res = await apiFetch(`/api/prescriptions/appointment/${id}`, {
      token,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError || error?.status) {
      return NextResponse.json(
        { error: error.message || 'Prescription not found' },
        { status: error.status || 500 },
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
