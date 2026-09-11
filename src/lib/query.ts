import type { Observation, Outcome, Prediction, Signal } from "./types";
import type { Inference } from "./inference";

export type QueryKind = "summary" | "observations" | "signals" | "inferences" | "predictions" | "outcomes";

export type QueryInput = {
  kind: QueryKind;
  source?: string;
  limit?: number;
};

export type QueryMemory = {
  observations: Observation[];
  signals: Signal[];
  inferences: Inference[];
  predictions: Prediction[];
  outcomes: Outcome[];
};

function boundedLimit(limit?: number) {
  if (!Number.isFinite(limit)) return 25;
  return Math.max(1, Math.min(100, Math.floor(limit!)));
}

export function runStructuredQuery(input: QueryInput, memory: QueryMemory) {
  const limit = boundedLimit(input.limit);
  const source = input.source?.trim();
  const bySource = <T extends { sourceId?: string; subjectScope?: string }>(rows: T[]) =>
    source ? rows.filter(row => row.sourceId === source || row.subjectScope === source) : rows;

  if (input.kind === "summary") {
    return {
      classification: "memory_summary",
      counts: {
        observations: memory.observations.length,
        signals: memory.signals.length,
        inferences: memory.inferences.length,
        predictions: memory.predictions.length,
        outcomes: memory.outcomes.length,
      },
      openPredictions: memory.predictions.filter(row => row.status === "open").length,
      resolvedPredictions: memory.outcomes.length,
      signalKinds: [...new Set(memory.signals.map(row => row.kind))].sort(),
      inferenceKinds: [...new Set(memory.inferences.map(row => row.inferenceType))].sort(),
    };
  }

  if (input.kind === "observations") return { classification: "observed_fact", rows: bySource(memory.observations).slice(0, limit) };
  if (input.kind === "signals") return { classification: "signal", rows: bySource(memory.signals).slice(0, limit) };
  if (input.kind === "inferences") return { classification: "inference", rows: bySource(memory.inferences).slice(0, limit) };
  if (input.kind === "predictions") return { classification: "prediction", rows: bySource(memory.predictions).slice(0, limit) };
  return { classification: "outcome", rows: memory.outcomes.slice(0, limit) };
}
