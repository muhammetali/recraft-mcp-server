import { getApiKey } from './auth.js';
import {
  API_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
  RATE_LIMIT_RETRY_DELAY_MS,
} from './constants.js';

export interface RecraftError {
  code: number;
  message: string;
}

export class RecraftClientError extends Error {
  constructor(
    public status: number,
    public error: RecraftError,
  ) {
    super(`Recraft API Error (${status}): ${error.message}`);
    this.name = 'RecraftClientError';
  }
}

function createAbortSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return {} as T;
  }

  const body = await response.text();

  if (!response.ok) {
    let error: RecraftError;
    try {
      const parsed = JSON.parse(body);
      error = {
        code: response.status,
        message: parsed.error?.message || parsed.message || parsed.detail || body.slice(0, 500),
      };
    } catch {
      error = {
        code: response.status,
        message: body.slice(0, 500),
      };
    }

    if (response.status === 402) {
      throw new RecraftClientError(402, {
        code: 402,
        message: 'Insufficient credits. Check your balance with recraft_check_credits.',
      });
    }

    throw new RecraftClientError(response.status, error);
  }

  if (!body) return {} as T;

  try {
    return JSON.parse(body) as T;
  } catch {
    return body as unknown as T;
  }
}

function authHeaders(contentType = 'application/json'): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': contentType,
  };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    signal: createAbortSignal(timeoutMs),
  });

  // Retry once on 429 (rate limit)
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_RETRY_DELAY_MS;
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetch(url, {
      ...options,
      signal: createAbortSignal(timeoutMs),
    });
  }

  return response;
}

// JSON POST
export async function recraftPost<T = any>(path: string, body: any, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  }, timeoutMs);
  return handleResponse<T>(response);
}

// GET
export async function recraftGet<T = any>(path: string): Promise<T> {
  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    headers: authHeaders(),
  }, DEFAULT_TIMEOUT_MS);
  return handleResponse<T>(response);
}

// Multipart POST (for file uploads)
export async function recraftPostMultipart<T = any>(
  path: string,
  formData: FormData,
  timeoutMs = UPLOAD_TIMEOUT_MS,
): Promise<T> {
  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      // Do NOT set Content-Type for multipart — fetch sets it with boundary
    },
    body: formData,
  }, timeoutMs);
  return handleResponse<T>(response);
}

// Download a URL to a buffer
export async function downloadToBuffer(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Buffer> {
  const response = await fetch(url, {
    signal: createAbortSignal(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Failed to download from ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
