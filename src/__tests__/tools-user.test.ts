import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));

import { checkCredits } from '../tools/user.js';

describe('tools/user', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns formatted user info', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        credits: 5000,
      }), { status: 200 }),
    );

    const result = await checkCredits();
    expect(result).toContain('Recraft Account Info');
    expect(result).toContain('Test User');
    expect(result).toContain('test@example.com');
    expect(result).toContain('5000');
    expect(result).toContain('user-123');
  });

  it('handles missing name gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: 'user-456',
        email: 'x@y.com',
        credits: 100,
      }), { status: 200 }),
    );

    const result = await checkCredits();
    expect(result).toContain('N/A');
    expect(result).toContain('100');
  });

  it('throws on API error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 }),
    );

    await expect(checkCredits()).rejects.toThrow();
  });
});
