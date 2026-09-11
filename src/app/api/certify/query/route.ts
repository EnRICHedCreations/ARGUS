import { NextResponse } from "next/server";
import { runStructuredQuery } from "@/lib/query";
import type { Inference } from "@/lib/inference";
import type { Observation, Outcome, Prediction, Signal } from "@/lib/types";

export async function GET() {
  const observation: Observation = { id: "o1", sourceId: "fixture", externalId: "e1", title: "Fixture event", url: "https://example.com/e1", publishedAt: "2026-01-01T00:00:00.000Z", observedAt: "2026-01-01T00:01:00.000Z", summary: "fixture", fingerprint: "f1" };
  const signal: Signal = { id: "s1", kind: "novelty", sourceId: "fixture", observedAt: "2026-01-01T00:02:00.000Z", score: 2, baseline: 1, current: 2, evidenceObservationIds: ["o1"] };
  const inference: Inference = { id: "i1", signalId: "s1", inferenceType: "novelty", subjectScope: "fixture", statement: "Fixture inference", inferredAt: "2026-01-01T00:02:00.000Z", confidence: 0.7, derivationMethod: "deterministic_signal_interpretation_v1", evidenceObservationIds: ["o1"], details: {} };
  const prediction: Prediction = { id: "p1", predictionType: "source_activity_elevated", subjectScope: "fixture", statement: "Fixture prediction", predictedAt: "2026-01-01T00:03:00.000Z", horizonHours: 1, resolvesAt: "2026-01-01T01:03:00.000Z", probability: 0.7, status: "resolved", modelVersion: "deterministic_oracle_v1", evidenceSignalIds: ["s1"], evidenceObservationIds: ["o1"], details: { threshold: 1 } };
  const outcome: Outcome = { id: "r1", predictionId: "p1", resolvedAt: "2026-01-01T01:04:00.000Z", outcome: true, actualValue: 1, targetValue: 1, brierScore: 0.09, absoluteError: 0, resolutionMethod: "deterministic_source_activity_v1", evidenceObservationIds: ["o1"], details: {} };
  const memory = { observations: [observation], signals: [signal], inferences: [inference], predictions: [prediction], outcomes: [outcome] };
  const kinds = ["summary", "observations", "signals", "inferences", "predictions", "outcomes"] as const;
  const results = kinds.map(kind => ({ kind, result: runStructuredQuery({ kind, source: kind === "outcomes" ? undefined : "fixture", limit: 5 }, memory) }));
  const classifications = results.map(row => (row.result as { classification?: string }).classification).filter(Boolean);
  const expected = ["memory_summary", "observed_fact", "signal", "inference", "prediction", "outcome"];
  const pass = expected.every(value => classifications.includes(value));
  return NextResponse.json({ certification: "gate7_structured_query_runtime", sideEffects: "none", llmProvider: "none", expectedClassifications: expected, observedClassifications: classifications, pass });
}
