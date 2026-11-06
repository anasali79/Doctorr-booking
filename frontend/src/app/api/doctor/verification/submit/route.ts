import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getNormalizedBaseUrl } from '@/lib/api/axios';

export async function POST(req: NextRequest) {
  try {
    const { token } = await getSession();
    const authHeader =
      req.headers.get('authorization') || (token ? `Bearer ${token}` : null);

    if (!authHeader) {
      return NextResponse.json(
        { message: 'Unauthorized. Please sign in.' },
        { status: 401 },
      );
    }

    const formData = await req.formData();
    const backendUrl = `${getNormalizedBaseUrl()}/api/doctor/verification/submit`;

    const backendRes = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });

    const data = await backendRes.json().catch(() => ({}));

    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'Failed to submit verification' },
      { status: 500 },
    );
  }
}

