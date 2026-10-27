import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiFetch } from '@/lib/api/client';
import { SESSION_COOKIE_NAME } from '@/lib/constants';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get('token')?.value ||
      cookieStore.get('jwt')?.value ||
      cookieStore.get(SESSION_COOKIE_NAME)?.value;

    // Optional: notify backend logout
    if (token) {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          token,
        });
      } catch {
        // Ignore backend errors during logout
      }
    }

    const response = NextResponse.json({ success: true, message: 'Logged out' });

    // Clear all token/jwt cookies
    response.cookies.delete('token');
    response.cookies.delete('jwt');
    response.cookies.delete(SESSION_COOKIE_NAME);

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Logout failed' }, { status: 500 });
  }
}
