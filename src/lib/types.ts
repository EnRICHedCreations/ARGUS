export type Observation = {
  id: string;
  sourceId: string;
  externalId: string;
  title: string;
  url: string;
  publishedAt: string;
  observedAt: string;
  summary: string;
  fingerprint: string;
};

export type SignalKind =
  | "volume_spike"
  | "z_score"
  | "acceleration"
  | "novelty"
  | "co_occurrence"
  | "centrality_shift"
  | "change_point"
  | "cross_source_correlation";

export type Signal = {
  id: string;
  kind: SignalKind;
  sourceId: string;
  observedAt: string;
  score: number;
  baseline: number;
  current: number;
  evidenceObservationIds: string[];
  details?: Record<string, unknown>;
};

export type Source = {
  id: string;
  name: string;
  url: string;
  kind: "rss" | "atom";
  enabled: boolean;
};
