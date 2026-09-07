// Recraft API Base URL
export const API_BASE_URL = 'https://external.api.recraft.ai/v1';

// API Endpoints
export const ENDPOINTS = {
  GENERATIONS: '/images/generations',
  IMAGE_TO_IMAGE: '/images/imageToImage',
  INPAINT: '/images/inpaint',
  REPLACE_BACKGROUND: '/images/replaceBackground',
  GENERATE_BACKGROUND: '/images/generateBackground',
  VARIATE_IMAGE: '/images/variateImage',
  REMOVE_BACKGROUND: '/images/removeBackground',
  VECTORIZE: '/images/vectorize',
  CRISP_UPSCALE: '/images/crispUpscale',
  CREATIVE_UPSCALE: '/images/creativeUpscale',
  ERASE_REGION: '/images/eraseRegion',
  OUTPAINT: '/images/outpaint',
  EXPLORE: '/images/explore',
  EXPLORE_SIMILAR: '/images/explore/similar',
  ENHANCE_PROMPT: '/prompts/enhance',
  STYLES: '/styles',
  STYLES_BASIC: '/styles/basic',
  MODELS: '/models',
  USERS_ME: '/users/me',
} as const;

// Timeouts
export const DEFAULT_TIMEOUT_MS = 30_000;
export const UPLOAD_TIMEOUT_MS = 120_000;
export const PIPELINE_TIMEOUT_MS = 60_000;
export const RATE_LIMIT_RETRY_DELAY_MS = 2_000;
export const BATCH_DELAY_MS = 300;

// Models
export const MODELS = [
  'recraftv4_1',
  'recraftv4_1_vector',
  'recraftv4_1_pro',
  'recraftv4_1_pro_vector',
  'recraftv4_1_utility',
  'recraftv4_1_utility_vector',
  'recraftv4_1_utility_pro',
  'recraftv4_1_utility_pro_vector',
  'recraftv4',
  'recraftv4_vector',
  'recraftv4_pro',
  'recraftv4_pro_vector',
  'recraftv4_styles',
  'recraftv4_styles_vector',
  'recraftv4_styles_pro',
  'recraftv4_styles_pro_vector',
  'recraftv3',
  'recraftv3_vector',
  'recraftv2',
  'recraftv2_vector',
] as const;
export type RecraftModel = (typeof MODELS)[number];

// Supported sizes (pixel format)
export const SUPPORTED_SIZES = [
  '1024x1024',
  '1152x928',
  '928x1152',
  '1216x832',
  '832x1216',
  '1152x896',
  '896x1152',
  '1344x768',
  '768x1344',
  '1472x736',
  '736x1472',
  '1824x608',
  '608x1824',
] as const;
export type SupportedSize = (typeof SUPPORTED_SIZES)[number];

// Supported ratio format (for vector models)
export const SUPPORTED_RATIOS = [
  '1:1', '4:5', '5:4', '2:3', '3:2', '3:4', '4:3',
  '9:16', '16:9', '1:2', '2:1', '1:3', '3:1',
] as const;
export type SupportedRatio = (typeof SUPPORTED_RATIOS)[number];

// Response formats
export const RESPONSE_FORMATS = ['url', 'b64_json'] as const;
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

// Style taxonomy, generated from Recraft's OpenAPI spec
// (https://external.api.recraft.ai/doc/spec/internal/externalapi/api.yaml).
//
// Recraft's taxonomy has two levels, and they are two separate request
// fields: `style` picks one of six broad families, `substyle` picks the
// specific look within it. The previous version flattened both into one
// list and never sent `substyle` at all, so all 104 substyles below were
// unreachable — asking for `pixel_art` put it in the free-form `style`
// field, where it does nothing.

export const IMAGE_STYLES = [
  'any', 'digital_illustration', 'icon', 'realistic_image',
  'vector_illustration', 'logo_raster',
] as const;
export type RecraftStyle = (typeof IMAGE_STYLES)[number];

export const IMAGE_SUBSTYLES = [
  '2d_art_poster', '3d', '80s', 'glow',
  'grain', 'hand_drawn', 'infantile_sketch', 'kawaii',
  'pixel_art', 'psychedelic', 'seamless', 'voxel',
  'watercolor', 'broken_line', 'colored_outline', 'colored_shapes',
  'colored_shapes_gradient', 'doodle_fill', 'doodle_offset_fill', 'offset_fill',
  'outline', 'outline_gradient', 'cartoon', 'doodle_line_art',
  'engraving', 'flat_2', 'line_art', 'linocut',
  'b_and_w', 'enterprise', 'hard_flash', 'hdr',
  'motion_blur', 'natural_light', 'studio_portrait', 'line_circuit',
  '2d_art_poster_2', 'engraving_color', 'hand_drawn_outline', 'handmade_3d',
  'plastic', 'pictogram', 'antiquarian', 'bold_fantasy',
  'child_book', 'cover', 'crosshatch', 'digital_engraving',
  'expressionism', 'freehand_details', 'grain_20', 'graphic_intensity',
  'hard_comics', 'long_shadow', 'modern_folk', 'multicolor',
  'neon_calm', 'noir', 'nostalgic_pastel', 'outline_details',
  'pastel_gradient', 'pastel_sketch', 'pop_art', 'pop_renaissance',
  'street_art', 'tablet_sketch', 'urban_glow', 'urban_sketching',
  'young_adult_book', 'young_adult_book_2', 'evening_light', 'faded_nostalgia',
  'forest_life', 'mystic_naturalism', 'natural_tones', 'organic_calm',
  'real_life_glow', 'retro_realism', 'retro_snapshot', 'urban_drama',
  'village_realism', 'warm_folk', 'bold_stroke', 'chemistry',
  'colored_stencil', 'cosmics', 'cutout', 'depressive',
  'editorial', 'emotional_flat', 'marker_outline', 'mosaic',
  'naivector', 'roundish_flat', 'segmented_colors', 'sharp_contrast',
  'thin', 'vector_photo', 'vivid_shapes', 'emblem_graffiti',
  'emblem_pop_art', 'emblem_punk', 'emblem_stamp', 'emblem_vintage',
] as const;
export type RecraftSubstyle = (typeof IMAGE_SUBSTYLES)[number];

/// How strictly a custom style is applied to a generation.
export const STYLE_MATCH = ['regular', 'precise', 'flexible'] as const;
export type RecraftStyleMatch = (typeof STYLE_MATCH)[number];

// The names the previous version accepted. Recraft's `style` field is a
// free-form string, so these V2/V3-era names may still resolve server-side;
// they are kept so existing callers do not break, but they are no longer
// advertised and `substyle` is the field to reach for.
export const LEGACY_STYLE_ALIASES: Readonly<Record<string, { style?: RecraftStyle; substyle?: RecraftSubstyle }>> = {
  black_and_white: { style: 'realistic_image', substyle: 'b_and_w' },
  studio_photo: { style: 'realistic_image', substyle: 'studio_portrait' },
  colored_shape: { style: 'icon', substyle: 'colored_shapes' },
  gradient_outline: { style: 'icon', substyle: 'outline_gradient' },
  doodle: { style: 'icon', substyle: 'doodle_fill' },
  offset_doodle: { style: 'icon', substyle: 'doodle_offset_fill' },
  gradient_shape: { style: 'icon', substyle: 'colored_shapes_gradient' },
  color_engraving: { style: 'digital_illustration', substyle: 'engraving_color' },
  stamp: { style: 'logo_raster', substyle: 'emblem_stamp' },
  punk_graphic: { style: 'logo_raster', substyle: 'emblem_punk' },
  vintage_emblem: { style: 'logo_raster', substyle: 'emblem_vintage' },
  pop_graphic: { style: 'logo_raster', substyle: 'emblem_pop_art' },
  prestige_emblem: { style: 'logo_raster', substyle: 'emblem_graffiti' },
  seamless_digital: { style: 'digital_illustration', substyle: 'seamless' },
  seamless_vector: { style: 'vector_illustration', substyle: 'seamless' },
  photorealism: { style: 'realistic_image' },
  illustration: { style: 'digital_illustration' },
  vector_art: { style: 'vector_illustration' },
};

// Retained so `validateStyle` still accepts what it always did.
export const ALL_STYLES = [
  ...IMAGE_STYLES,
  ...IMAGE_SUBSTYLES,
  ...(Object.keys(LEGACY_STYLE_ALIASES) as readonly string[]),
] as const;

// File constraints
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_RESOLUTION_PIXELS = 16_000_000; // 16MP
export const MAX_DIMENSION_PX = 4096;
export const MIN_DIMENSION_PX = 256;
export const MIN_DIMENSION_UPSCALE_PX = 32;
export const MAX_PROMPT_LENGTH_V4 = 10_000;
export const MAX_PROMPT_LENGTH_V3 = 1_000;
export const MAX_IMAGES_PER_REQUEST = 6;

// Accepted input file extensions
export const ACCEPTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

// Style base types for create_style
export const STYLE_BASE_TYPES = ['any', 'realistic_image', 'digital_illustration', 'vector_illustration', 'icon'] as const;
export type StyleBaseType = (typeof STYLE_BASE_TYPES)[number];
