import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveStyle, validateSubstyle } from '../validation.js';
import { IMAGE_STYLES, IMAGE_SUBSTYLES, LEGACY_STYLE_ALIASES } from '../constants.js';
import { generateImage } from '../tools/generate.js';

/// Recraft's style taxonomy has two levels and they are two separate request
/// fields. The previous version flattened them into one list, never sent
/// `substyle`, and invented 25 names that appear in neither enum. These
/// tests pin the corrected shape — and, more importantly, assert what
/// actually goes over the wire, which is the thing no existing test in this
/// repo checks.
describe('style taxonomy', () => {
  it('matches the API: six families, a large strict substyle enum', () => {
    // If Recraft adds a family, this fails and someone re-reads the spec.
    // That is the intent: the previous list drifted precisely because
    // nothing tied it to the source.
    expect([...IMAGE_STYLES].sort()).toEqual([
      'any',
      'digital_illustration',
      'icon',
      'logo_raster',
      'realistic_image',
      'vector_illustration',
    ]);
    expect(IMAGE_SUBSTYLES.length).toBeGreaterThan(100);
  });

  it('keeps the two levels disjoint', () => {
    // A name in both lists would make `resolveStyle` ambiguous.
    const overlap = IMAGE_SUBSTYLES.filter((s) => (IMAGE_STYLES as readonly string[]).includes(s));
    expect(overlap).toEqual([]);
  });

  it('rejects a substyle the API does not define', () => {
    expect(() => validateSubstyle('definitely_not_a_substyle')).toThrow(/Unsupported substyle/);
  });

  describe('resolveStyle', () => {
    it('passes a real family through as `style`', () => {
      expect(resolveStyle('realistic_image')).toEqual({ style: 'realistic_image' });
    });

    it('routes a substyle name out of `style` into `substyle`', () => {
      // The bug this exists for: `pixel_art` is a substyle, but callers and
      // models say it as if it were a style, because that is how Recraft's
      // own UI names it. Sent in the `style` field it is silently ignored —
      // the request succeeds and the look is simply absent.
      expect(resolveStyle('pixel_art')).toEqual({ substyle: 'pixel_art' });
    });

    it('translates every legacy name to a pair the API accepts', () => {
      for (const [legacy, mapped] of Object.entries(LEGACY_STYLE_ALIASES)) {
        const resolved = resolveStyle(legacy);
        if (mapped.style) {
          expect(resolved.style, `${legacy} -> style`).toBe(mapped.style);
          expect(IMAGE_STYLES).toContain(resolved.style);
        }
        if (mapped.substyle) {
          expect(resolved.substyle, `${legacy} -> substyle`).toBe(mapped.substyle);
          expect(IMAGE_SUBSTYLES).toContain(resolved.substyle);
        }
      }
    });

    it('does not let a legacy alias overwrite an explicit substyle', () => {
      // The caller was specific; the alias is a fallback, not an override.
      expect(resolveStyle('black_and_white', 'pixel_art')).toEqual({
        style: 'realistic_image',
        substyle: 'pixel_art',
      });
    });

    it('still rejects a name that is neither', () => {
      expect(() => resolveStyle('not_a_real_style')).toThrow(/Unsupported style/);
    });

    it('returns nothing when nothing was asked for', () => {
      expect(resolveStyle(undefined, undefined)).toEqual({});
    });
  });
});

/// These assert the request itself. The existing suite has 206 tests and
/// exactly one of them looks at a URL — so swapping two endpoint constants
/// would leave it entirely green. Every test here reads what was actually
/// sent.
describe('what generateImage puts on the wire', () => {
  let sent: { url: string; body: any };

  beforeEach(() => {
    process.env.RECRAFT_API_KEY = 'test-key';
    sent = { url: '', body: null };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: any) => {
        sent = { url: String(url), body: JSON.parse(options.body) };
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              created: 1,
              credits: 40,
              data: [{ image_id: 'img-1', url: 'https://example.com/1.png' }],
            }),
        };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the generations endpoint', async () => {
    await generateImage({ prompt: 'a cat' });
    expect(sent.url).toBe('https://external.api.recraft.ai/v1/images/generations');
  });

  it('sends a substyle in the substyle field, not the style field', async () => {
    await generateImage({ prompt: 'a cat', style: 'pixel_art' });
    expect(sent.body.substyle).toBe('pixel_art');
    expect(sent.body.style).toBeUndefined();
  });

  it('sends both fields when both are meant', async () => {
    await generateImage({ prompt: 'a cat', style: 'digital_illustration', substyle: 'kawaii' });
    expect(sent.body.style).toBe('digital_illustration');
    expect(sent.body.substyle).toBe('kawaii');
  });

  it('expands a legacy name into the pair it stands for', async () => {
    await generateImage({ prompt: 'a portrait', style: 'black_and_white' });
    expect(sent.body.style).toBe('realistic_image');
    expect(sent.body.substyle).toBe('b_and_w');
  });

  it('reports what the call cost', async () => {
    // Recraft states the price of every call it serves. Dropping it left
    // the model unable to tell a 4-credit operation from a 250-credit one.
    const out = await generateImage({ prompt: 'a cat' });
    expect(out).toContain('Cost: 40 credits');
  });
});
