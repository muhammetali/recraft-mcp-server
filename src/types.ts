// Shared API response types used across tool implementations

export interface GenerationResult {
  data: Array<{ image_id: string; url: string }>;
}

export interface BgRemoveResult {
  image: { url: string };
}

export interface CreateStyleResult {
  id: string;
}
