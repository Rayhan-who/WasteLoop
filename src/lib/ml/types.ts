/**
 * Shared types for the deferred ML features (Phase 2).
 *
 * SRS §4.8: every prediction is advisory, explainable and human-overridable,
 * and the product falls back to simple rules when a prediction is missing.
 * Hence every prediction carries a confidence, the model that produced it,
 * and a human-readable explanation, and every caller handles `null`.
 */
export type MLPrediction<T> = {
  value: T;
  /** 0–1. */
  confidence: number;
  modelVersion: string;
  /** Short, user-facing reason for the suggestion. */
  explanation: string;
};

/** What a stub returns until its model ships: null means "use the fallback". */
export type MaybePrediction<T> = Promise<MLPrediction<T> | null>;
