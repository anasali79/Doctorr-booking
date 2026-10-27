import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';
import { cache } from 'react';
import { SESSION_COOKIE_NAME } from '../constants';
import { SessionUser } from '@/types';

export interface SessionResult {
  user: SessionUser | null;
  token: string | null;
}

/**
 * Retrieves the current session on the server side by reading the JWT from cookies.
 * Deduplicated per-request with React cache().
 */
export const getSession = cache(async function getSession(): Promise<SessionResult> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get('token')?.value ||
    cookieStore.get('jwt')?.value ||
    cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return { user: null, token: null };
  }

  try {
    const payload = decodeJwt(token) as Record<string, any>;

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return { user: null, token: null };
    }

    const userId = payload.sub || payload.id;
    if (!userId || !payload.role) {
      return { user: null, token: null };
    }

    return {
      user: {
        id: userId,
        email: payload.email || '',
        role: payload.role,
        exp: payload.exp,
      },
      token,
    };
  } catch {
    return { user: null, token: null };
  }
});
