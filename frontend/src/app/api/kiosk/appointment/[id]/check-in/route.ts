import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const res = await apiFetch(`/api/kiosk/appointment/${id}/check-in`, {
      method: 'POST',
    });
    return NextResponse.json(res);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Check-in failed' },
      { status: 500 },
    );
  }
}
