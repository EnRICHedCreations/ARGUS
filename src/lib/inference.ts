import { createHash } from "node:crypto";
import type { Signal } from "./types";

export type Inference = {
  id: string;
  signalId: string;
  inferenceType: Signal["kind"];
  subjectScope: string;
  statement: string;
  inferredAt: string;
  confidence: number;
  derivationMethod: "deterministic_signal_interpretation_v1";
  evidenceObservationIds: string[];
  details: Record<string, unknown>;
};

function idFor(signal: Signal) {
  return createHash("sha256").update(`inference\n${signal.id}`).digest("hex").slice(0, 32);
}

function confidenceFor(signal: Signal) {
  const magnitude = Math.max(0, Number(signal.score) || 0);
  return Number(Math.min(0.95, 0.55 + Math.log10(1 + magnitude) * 0.18).toFixed(4));
}

function statementFor(signal: Signal) {
  switch (signal.kind) {
    case "volume_spike": return `Activity from ${signal.sourceId} is unusually elevated relative to its recent baseline.`;
    case "z_score": return `Activity from ${signal.sourceId} is statistically unusual relative to recent variation.`;
    case "acceleration": return `Activity from ${signal.sourceId} is accelerating unusually quickly.`;
    case "novelty": return `Recent information from ${signal.sourceId} contains unusually novel content relative to its recent history.`;
    case "co_occurrence": return `A recurring entity co-occurrence pattern has emerged in the current world model.`;
    case "centrality_shift": return `An entity has become unusually more connected in the recent relationship graph.`;
    case "change_point": return `Activity from ${signal.sourceId} appears to have shifted into a materially different regime.`;
    case "cross_source_correlation": return `Multiple independent sources are showing concurrent elevated activity.`;
  }
}

export function deriveInferences(signals: Signal[]): Inference[] {
  return signals.map(signal => ({
    id: idFor(signal),
    signalId: signal.id,
    inferenceType: signal.kind,
    subjectScope: signal.sourceId,
    statement: statementFor(signal),
    inferredAt: signal.observedAt,
    confidence: confidenceFor(signal),
    derivationMethod: "deterministic_signal_interpretation_v1",
    evidenceObservationIds: [...new Set(signal.evidenceObservationIds)],
    details: { score: signal.score, baseline: signal.baseline, current: signal.current, signalDetails: signal.details ?? {} },
  }));
}
