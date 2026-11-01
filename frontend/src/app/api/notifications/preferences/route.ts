import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET() {
  try {
    const { token } = await getSession();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await apiFetch('/api/notifications/preferences', {
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

export async function PATCH(req: NextRequest) {
  try {
    const { token } = await getSession();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Sanitize payload: explicitly extract only valid boolean preference fields
    const sanitizedBody: Record<string, boolean> = {};
    const allowedKeys = [
      'emailEnabled',
      'inAppEnabled',
      'whatsappEnabled',
      'smsEnabled',
      'remindersEnabled',
      'paymentAlertsEnabled',
      'refundAlertsEnabled',
    ];

    for (const key of allowedKeys) {
      if (typeof body[key] === 'boolean') {
        sanitizedBody[key] = body[key];
      }
    }

    const res = await apiFetch('/api/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(sanitizedBody),
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

