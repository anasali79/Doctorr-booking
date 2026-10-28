import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

export class ApiError extends Error {
  status: number;
  data?: unknown;
  code?: string;

  constructor(status: number, message: string, data?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = code;
  }
}

/**
 * Normalizes the backend base URL.
 * Checks API_URL, NEXT_PUBLIC_API_URL, or defaults to the production Render backend.
 * Ensures no duplicate trailing slashes and handles if /api is appended.
 */
export function getNormalizedBaseUrl(): string {
  let raw = (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://doctorr-booking-1.onrender.com'
  ).trim();

  // Strip trailing slashes
  raw = raw.replace(/\/+$/, '');

  // Strip trailing /api if user added it, because all backend paths in our app start with /api
  if (raw.endsWith('/api')) {
    raw = raw.slice(0, -4);
  }

  return raw;
}

export const API_BASE_URL = getNormalizedBaseUrl();

/**
 * Extracts a clean, human-readable error message from an Axios error or generic error,
 * specially parsing NestJS ExceptionFilter formats:
 * { statusCode: 400, message: ['email must be an email', ...], error: 'Bad Request' }
 * or { statusCode: 404, message: 'Patient profile not found...', error: 'Not Found' }
 */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;

    if (data) {
      if (Array.isArray(data.message)) {
        return data.message.join(' • ');
      }
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        return data.message;
      }
      if (typeof data.error === 'string' && data.error.trim().length > 0) {
        return data.error;
      }
      if (typeof data === 'string' && data.trim().length > 0) {
        return data;
      }
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Request timed out. The server took too long to respond.';
    }

    if (error.message === 'Network Error' || !error.response) {
      return 'Network error: Unable to connect to Schedula server. Please check your internet connection.';
    }

    const status = error.response?.status;
    if (status === 401) return 'Invalid credentials or session expired. Please sign in again.';
    if (status === 403) return 'Access denied. You do not have permission for this action.';
    if (status === 404) return 'The requested resource was not found.';
    if (status === 409) return 'Conflict detected (e.g. slot is already booked or appointment exists).';
    if (status === 422) return 'Unprocessable request. Please check submitted data.';
    if (status >= 500) return 'Server error occurred on Schedula backend. Please try again later.';

    return error.message || 'An unexpected error occurred.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

/**
 * Server-side / Core Axios Instance targeting the real NestJS Backend
 */
export const serverAxios: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor for serverAxios
serverAxios.interceptors.request.use(
  (config) => {
    // If baseURL is already set, ensure URL does not duplicate /api if both have it
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for serverAxios
serverAxios.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status || 500;
    const message = extractErrorMessage(error);
    return Promise.reject(new ApiError(status, message, error.response?.data, error.code));
  },
);

/**
 * Browser-side Axios Instance for client components calling Next.js API route handlers
 * or directly with auth tokens.
 */
export const clientAxios: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

clientAxios.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status || 500;
    const message = extractErrorMessage(error);
    return Promise.reject(new ApiError(status, message, error.response?.data, error.code));
  },
);

// In-memory cache for fast server-side & client-side GET operations
interface CacheEntry {
  data: any;
  expiry: number;
}
const requestCache = new Map<string, CacheEntry>();

// Cacheable endpoints and their TTL in milliseconds
const CACHE_RULES: Record<string, number> = {
  '/api/doctor/profile': 30_000,
  '/api/patient/profile': 30_000,
  '/api/doctor': 20_000,
  '/api/notifications/unread-count': 10_000,
};

export function clearApiCache() {
  requestCache.clear();
}

/**
 * Universal Axios-based requester replacing the old `apiFetch`.
 * Fully backward-compatible signature so all services can use it directly.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    data?: any;
    body?: any; // for backward compatibility with fetch
    params?: Record<string, any>;
    token?: string;
    headers?: Record<string, string>;
    skipCache?: boolean;
  } = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase() as any;
  const headers: Record<string, string> = { ...options.headers };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  // Handle body or data
  let payload = options.data !== undefined ? options.data : options.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      // Keep as string if not JSON
    }
  }

  // Clean params
  const cleanParams: Record<string, any> = {};
  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanParams[key] = val;
      }
    });
  }

  // Invalidate cache on mutations
  if (method !== 'GET') {
    requestCache.clear();
  }

  // Check GET cache
  const cacheKey = method === 'GET' && !options.skipCache
    ? `${options.token || ''}:${endpoint}:${JSON.stringify(cleanParams)}`
    : null;

  if (cacheKey) {
    const cached = requestCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }
  }

  try {
    const response = await serverAxios.request<T>({
      url: endpoint,
      method,
      data: payload,
      params: Object.keys(cleanParams).length > 0 ? cleanParams : undefined,
      headers,
    });

    // Determine if this endpoint should be cached
    if (cacheKey && method === 'GET') {
      const matchedRule = Object.keys(CACHE_RULES).find((path) => endpoint.startsWith(path));
      const ttl = matchedRule ? CACHE_RULES[matchedRule] : 15_000; // default 15s for GETs
      requestCache.set(cacheKey, {
        data: response.data,
        expiry: Date.now() + ttl,
      });
    }

    return response.data;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = extractErrorMessage(err);
    const status = axios.isAxiosError(err) ? err.response?.status || 500 : 500;
    throw new ApiError(status, message, axios.isAxiosError(err) ? err.response?.data : undefined);
  }
}
