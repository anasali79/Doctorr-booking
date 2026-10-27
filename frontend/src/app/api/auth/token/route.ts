import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/constants';

export async function GET() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get('token')?.value ||
    cookieStore.get('jwt')?.value ||
    cookieStore.get(SESSION_COOKIE_NAME)?.value ||
    null;
  return NextResponse.json({ token });
}
