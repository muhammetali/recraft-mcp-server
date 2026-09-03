import { describe, it, expect } from 'vitest';
import {
  API_BASE_URL, ENDPOINTS, MODELS, SUPPORTED_SIZES, SUPPORTED_RATIOS,
  ALL_STYLES, V3_RASTER_STYLES, V3_VECTOR_STYLES, V2_ICON_STYLES,
  STYLE_BASE_TYPES, ACCEPTED_IMAGE_EXTENSIONS, RESPONSE_FORMATS,
  DEFAULT_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, MAX_FILE_SIZE_BYTES,
  MAX_PROMPT_LENGTH_V4, MAX_PROMPT_LENGTH_V3, MAX_IMAGES_PER_REQUEST,
} from '../constants.js';

describe('constants', () => {
  it('API_BASE_URL is correct', () => {
    expect(API_BASE_URL).toBe('https://external.api.recraft.ai/v1');
  });

  it('all endpoints are defined', () => {
    expect(Object.keys(ENDPOINTS)).toHaveLength(17);
    expect(ENDPOINTS.GENERATIONS).toBe('/images/generations');
    expect(ENDPOINTS.REMOVE_BACKGROUND).toBe('/images/removeBackground');
    expect(ENDPOINTS.VECTORIZE).toBe('/images/vectorize');
    expect(ENDPOINTS.CRISP_UPSCALE).toBe('/images/crispUpscale');
    expect(ENDPOINTS.CREATIVE_UPSCALE).toBe('/images/creativeUpscale');
    expect(ENDPOINTS.ERASE_REGION).toBe('/images/eraseRegion');
    expect(ENDPOINTS.OUTPAINT).toBe('/images/outpaint');
    expect(ENDPOINTS.EXPLORE).toBe('/images/explore');
    expect(ENDPOINTS.EXPLORE_SIMILAR).toBe('/images/explore/similar');
    expect(ENDPOINTS.ENHANCE_PROMPT).toBe('/prompts/enhance');
    expect(ENDPOINTS.USERS_ME).toBe('/users/me');
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

  it('ALL_STYLES combines V3 raster, V3 vector, V2 icon styles', () => {
    expect(ALL_STYLES.length).toBe(
      V3_RASTER_STYLES.length + V3_VECTOR_STYLES.length + V2_ICON_STYLES.length
    );
    expect(ALL_STYLES).toContain('photorealism');
    expect(ALL_STYLES).toContain('vector_art');
    expect(ALL_STYLES).toContain('icon');
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
