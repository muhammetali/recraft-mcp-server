import { describe, it, expect } from 'vitest';
import {
  API_BASE_URL, ENDPOINTS, MODELS, SUPPORTED_SIZES, SUPPORTED_RATIOS,
  ALL_STYLES, IMAGE_STYLES, IMAGE_SUBSTYLES, LEGACY_STYLE_ALIASES,
  STYLE_BASE_TYPES, ACCEPTED_IMAGE_EXTENSIONS, RESPONSE_FORMATS,
  DEFAULT_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, MAX_FILE_SIZE_BYTES,
  MAX_PROMPT_LENGTH_V4, MAX_PROMPT_LENGTH_V3, MAX_IMAGES_PER_REQUEST,
} from '../constants.js';

describe('constants', () => {
  it('API_BASE_URL is correct', () => {
    expect(API_BASE_URL).toBe('https://external.api.recraft.ai/v1');
  });

  it('every endpoint is a path Recraft actually serves', () => {
    // This replaced a test that asserted `Object.keys(ENDPOINTS).length` and
    // then restated each literal — it went red whenever an endpoint was
    // added, which is noise, and could never catch the failure that
    // matters: a path the API does not have. This list is the operation set
    // from Recraft's OpenAPI document (paths minus the `/v1` prefix the
    // base URL already carries).
    const SERVED = new Set([
      '/colors/optimize',
      '/images/clarityUpscale',
      '/images/creativeUpscale',
      '/images/crispUpscale',
      '/images/eraseRegion',
      '/images/explore',
      '/images/explore/similar',
      '/images/generateBackground',
      '/images/generations',
      '/images/generations/raster',
      '/images/generations/vector',
      '/images/generativeUpscale',
      '/images/imageToImage',
      '/images/inpaint',
      '/images/outpaint',
      '/images/removeBackground',
      '/images/replaceBackground',
      '/images/variateImage',
      '/images/vectorize',
      '/models',
      '/prompts/enhance',
      '/styles',
      '/styles/basic',
      '/users/me',
    ]);

    for (const [name, path] of Object.entries(ENDPOINTS)) {
      expect(SERVED, `${name} -> ${path}`).toContain(path);
    }
  });

  it('models include V4.1, V4 Styles, V4, V3, V2 variants', () => {
    expect(MODELS).toContain('recraftv4_1');
    expect(MODELS).toContain('recraftv4_1_pro');
    expect(MODELS).toContain('recraftv4_styles');
    expect(MODELS).toContain('recraftv4');
    expect(MODELS).toContain('recraftv4_vector');
    expect(MODELS).toContain('recraftv4_pro');
    expect(MODELS).toContain('recraftv3');
    expect(MODELS).toContain('recraftv2');
    expect(MODELS.length).toBeGreaterThanOrEqual(20);
  });

  it('supported sizes are valid pixel dimensions', () => {
    for (const size of SUPPORTED_SIZES) {
      expect(size).toMatch(/^\d+x\d+$/);
    }
    expect(SUPPORTED_SIZES).toContain('1024x1024');
    expect(SUPPORTED_SIZES).toContain('1344x768');
  });

  it('supported ratios are valid', () => {
    for (const ratio of SUPPORTED_RATIOS) {
      expect(ratio).toMatch(/^\d+:\d+$/);
    }
    expect(SUPPORTED_RATIOS).toContain('1:1');
    expect(SUPPORTED_RATIOS).toContain('16:9');
  });

  it('ALL_STYLES accepts both levels plus the names it used to accept', () => {
    // ALL_STYLES exists only so `validateStyle` keeps accepting everything
    // it accepted before the taxonomy was corrected. Its job is backwards
    // compatibility, not description — the two real vocabularies are
    // IMAGE_STYLES and IMAGE_SUBSTYLES.
    expect(ALL_STYLES.length).toBe(
      IMAGE_STYLES.length + IMAGE_SUBSTYLES.length + Object.keys(LEGACY_STYLE_ALIASES).length
    );
    expect(ALL_STYLES).toContain('photorealism'); // legacy
    expect(ALL_STYLES).toContain('realistic_image'); // family
    expect(ALL_STYLES).toContain('pixel_art'); // substyle
  });

  it('every legacy alias maps onto values the API defines', () => {
    // The aliases are the bridge between the old invented vocabulary and
    // the real one. An alias pointing at another invented name would just
    // move the bug.
    for (const mapped of Object.values(LEGACY_STYLE_ALIASES)) {
      if (mapped.style) expect(IMAGE_STYLES).toContain(mapped.style);
      if (mapped.substyle) expect(IMAGE_SUBSTYLES).toContain(mapped.substyle);
    }
  });

  it('style base types are valid', () => {
    expect(STYLE_BASE_TYPES).toContain('any');
    expect(STYLE_BASE_TYPES).toContain('realistic_image');
    expect(STYLE_BASE_TYPES).toContain('vector_illustration');
  });

  it('file constraints are reasonable', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_PROMPT_LENGTH_V4).toBe(10_000);
    expect(MAX_PROMPT_LENGTH_V3).toBe(1_000);
    expect(MAX_IMAGES_PER_REQUEST).toBe(6);
  });

  it('timeouts are set correctly', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
    expect(UPLOAD_TIMEOUT_MS).toBe(120_000);
  });

  it('accepted extensions include common image formats', () => {
    expect(ACCEPTED_IMAGE_EXTENSIONS).toContain('.png');
    expect(ACCEPTED_IMAGE_EXTENSIONS).toContain('.jpg');
    expect(ACCEPTED_IMAGE_EXTENSIONS).toContain('.jpeg');
    expect(ACCEPTED_IMAGE_EXTENSIONS).toContain('.webp');
  });

  it('response formats include url and b64_json', () => {
    expect(RESPONSE_FORMATS).toContain('url');
    expect(RESPONSE_FORMATS).toContain('b64_json');
  });
});
