import "server-only";

/**
 * Per-feature flags for the deferred ML features. All read from the
 * environment and all default to false (see .env.example). Turning a flag on
 * is the only change needed once its model exists.
 */
function flag(name: string): boolean {
  return process.env[name] === "true";
}

export const mlFlags = {
  /** FR-3.6 photo → waste category */
  suggestCategory: () => flag("ML_SUGGEST_CATEGORY"),
  /** FR-3.7 quantity / resource-value estimation */
  estimateQuantity: () => flag("ML_ESTIMATE_QUANTITY"),
  /** FR-3.8 freshness indicator */
  freshness: () => flag("ML_FRESHNESS"),
  /** FR-4.5 personalised recommendations */
  recommendations: () => flag("ML_RECOMMENDATIONS"),
  /** FR-4.6 supply / demand forecasting */
  forecast: () => flag("ML_FORECAST"),
  /** FR-6.4 route clustering */
  routeClustering: () => flag("ML_ROUTE_CLUSTERING"),
  /** FR-6.5 completion-likelihood score */
  completionLikelihood: () => flag("ML_COMPLETION_LIKELIHOOD"),
  /** FR-7.4 fair price suggestion */
  priceSuggestion: () => flag("ML_PRICE_SUGGESTION"),
  /** FR-11.4 anomaly detection */
  anomalyDetection: () => flag("ML_ANOMALY_DETECTION"),
  /** FR-11.5 content screening */
  contentScreening: () => flag("ML_CONTENT_SCREENING"),
} as const;
