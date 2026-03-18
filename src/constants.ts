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
  STYLES: '/styles',
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
  'recraftv4',
  'recraftv4_vector',
  'recraftv4_pro',
  'recraftv4_pro_vector',
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
  '1820x1024',
  '1024x1820',
  '1536x1024',
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

// V3 Raster styles
export const V3_RASTER_STYLES = [
  // Photorealistic
  'photorealism', 'enterprise', 'natural_light', 'studio_photo', 'hdr',
  'hard_flash', 'motion_blur', 'black_and_white', 'evening_light',
  'faded_nostalgia', 'forest_life', 'mystic_naturalism', 'natural_tones',
  'organic_calm', 'real_life_glow', 'retro_realism', 'retro_snapshot',
  'urban_drama', 'village_realism', 'warm_folk', 'product_photo',
  // Illustration
  'illustration', 'hand_drawn', 'grain', 'bold_sketch', 'pencil_sketch',
  'retro_pop', 'clay', 'risograph', 'color_engraving', 'pixel_art',
  'antiquarian', 'bold_fantasy', 'child_book', 'cover', 'crosshatch',
  'digital_engraving', 'expressionism', 'freehand_details', 'grain_20',
  'graphic_intensity', 'hard_comics', 'long_shadow', 'modern_folk',
  'multicolor', 'neon_calm', 'noir', 'nostalgic_pastel', 'outline_details',
  'pastel_gradient', 'pastel_sketch', 'pop_art', 'pop_renaissance',
  'street_art', 'tablet_sketch', 'urban_glow', 'urban_sketching',
  'young_adult_book', 'young_adult_book_2', 'seamless_digital',
  // Emblem
  'prestige_emblem', 'pop_graphic', 'stamp', 'punk_graphic', 'vintage_emblem',
] as const;

// V3 Vector styles
export const V3_VECTOR_STYLES = [
  'vector_art', 'line_art', 'linocut', 'color_blobs', 'engraving',
  'bold_stroke', 'chemistry', 'colored_stencil', 'cosmics', 'cutout',
  'depressive', 'editorial', 'emotional_flat', 'marker_outline', 'mosaic',
  'naivector', 'roundish_flat', 'segmented_colors', 'sharp_contrast', 'thin',
  'vector_photo', 'vivid_shapes', 'seamless_vector',
] as const;

// V2 Icon styles
export const V2_ICON_STYLES = [
  'icon', 'outline', 'pictogram', 'colored_outline', 'doodle',
  'colored_shape', 'gradient_outline', 'offset_doodle', 'gradient_shape',
  'broken_line', 'offset_fill',
] as const;

// All available styles
export const ALL_STYLES = [
  ...V3_RASTER_STYLES,
  ...V3_VECTOR_STYLES,
  ...V2_ICON_STYLES,
] as const;
export type RecraftStyle = (typeof ALL_STYLES)[number];

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
