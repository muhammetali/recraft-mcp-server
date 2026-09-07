// Shared API response types used across tool implementations

// `credits` is a required field on both response schemas — Recraft states
// the exact cost of every call it serves. The previous version parsed it and
// threw it away, so a paid API reported no price anywhere. It is optional
// here only so a stubbed or older response does not crash the formatter.
export interface GenerationResult {
  data: Array<{ image_id: string; url: string; b64_json?: string }>;
  credits?: number;
  style_id?: string;
}

export interface BgRemoveResult {
  image: { url: string; b64_json?: string };
  credits?: number;
}

export interface CreateStyleResult {
  id: string;
}
