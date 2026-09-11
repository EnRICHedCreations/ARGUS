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

export type Signal = {
  id: string;
  kind: "volume_spike";
  sourceId: string;
  observedAt: string;
  score: number;
  baseline: number;
  current: number;
  evidenceObservationIds: string[];
};

export type Source = {
  id: string;
  name: string;
  url: string;
  kind: "rss" | "atom";
  enabled: boolean;
};
