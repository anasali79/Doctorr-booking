import {
  apiRequest,
  ApiError,
  extractErrorMessage,
  getNormalizedBaseUrl,
  API_BASE_URL,
  serverAxios,
  clientAxios,
} from './axios';

export {
  ApiError,
  extractErrorMessage,
  getNormalizedBaseUrl,
  API_BASE_URL,
  serverAxios,
  clientAxios,
};

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  token?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  cache?: RequestCache;
}

/**
 * Universal API fetcher backed by Axios with unified error handling,
 * token injection, and NestJS validation error unpacking.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase() as any;

  return apiRequest<T>(endpoint, {
    method,
    body: options.body,
    params: options.params,
    token: options.token,
    headers: options.headers,
  });
}
