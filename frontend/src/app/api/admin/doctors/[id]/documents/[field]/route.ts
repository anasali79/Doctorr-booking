import { NextRequest, NextResponse } from 'next/server';
import { getNormalizedBaseUrl } from '@/lib/api/axios';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; field: string }> },
) {
  try {
    const { id, field } = await params;

    // Retrieve token from cookies or authorization header
    const token =
      req.cookies.get('admin_token')?.value ||
      req.cookies.get('token')?.value ||
      req.cookies.get('access_token')?.value ||
      req.cookies.get('jwt')?.value ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return new NextResponse('Unauthorized: Admin login required', {
        status: 401,
      });
    }

    const backendUrl = `${getNormalizedBaseUrl()}/api/admin/doctors/${id}/documents/${field}`;

    const backendRes = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text().catch(() => '');
      return new NextResponse(
        errText || 'Document not found or access denied',
        {
          status: backendRes.status,
        },
      );
    }

    const contentType =
      backendRes.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition =
      backendRes.headers.get('content-disposition') || 'inline';

    return new NextResponse(backendRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    return new NextResponse(err?.message || 'Failed to stream document', {
      status: 500,
    });
  }
}

