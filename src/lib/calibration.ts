import { createHash } from "node:crypto";
import type { Observation, Outcome, Prediction } from "./types";

function outcomeId(predictionId: string) {
  return createHash("sha256").update(`outcome\n${predictionId}`).digest("hex").slice(0, 32);
}

export function resolveDuePredictions(predictions: Prediction[], observations: Observation[], now = new Date()): Outcome[] {
  const due = predictions.filter(prediction => prediction.status === "open" && new Date(prediction.resolvesAt).getTime() <= now.getTime());
  return due.map(prediction => {
    const threshold = Number(prediction.details.threshold ?? 0);
    const start = new Date(prediction.predictedAt).getTime();
    const end = new Date(prediction.resolvesAt).getTime();
    const evidence = observations.filter(observation =>
      observation.sourceId === prediction.subjectScope &&
      new Date(observation.publishedAt).getTime() > start &&
      new Date(observation.publishedAt).getTime() <= end
    );
    const actual = evidence.length;
    const outcome = actual >= threshold;
    const y = outcome ? 1 : 0;
    const brier = (prediction.probability - y) ** 2;
    return {
      id: outcomeId(prediction.id),
      predictionId: prediction.id,
      resolvedAt: now.toISOString(),
      outcome,
      actualValue: actual,
      targetValue: threshold,
      brierScore: Number(brier.toFixed(6)),
      absoluteError: Math.abs(actual - threshold),
      resolutionMethod: "deterministic_source_activity_v1",
      evidenceObservationIds: evidence.map(observation => observation.id),
      details: {
        subjectScope: prediction.subjectScope,
        probability: prediction.probability,
        horizonHours: prediction.horizonHours,
      },
    };
  });
}

export function calibrationSummary(predictions: Prediction[], outcomes: Outcome[]) {
  if (!outcomes.length) return { resolved: 0, meanBrierScore: null, accuracy: null };
  const byPrediction = new Map(predictions.map(prediction => [prediction.id, prediction]));
  const meanBrierScore = outcomes.reduce((sum, outcome) => sum + outcome.brierScore, 0) / outcomes.length;
  const accuracy = outcomes.filter(outcome => outcome.outcome).length / outcomes.length;
  const buckets = new Map<number, { count: number; predicted: number; actual: number }>();
  for (const outcome of outcomes) {
    const prediction = byPrediction.get(outcome.predictionId);
    if (!prediction) continue;
    const bucket = Math.round(prediction.probability * 10) / 10;
    const row = buckets.get(bucket) ?? { count: 0, predicted: 0, actual: 0 };
    row.count += 1;
    row.predicted += prediction.probability;
    row.actual += outcome.outcome ? 1 : 0;
    buckets.set(bucket, row);
  }
  return {
    resolved: outcomes.length,
    meanBrierScore: Number(meanBrierScore.toFixed(6)),
    accuracy: Number(accuracy.toFixed(6)),
    buckets: [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([bucket, row]) => ({
      bucket,
      count: row.count,
      meanPredictedProbability: Number((row.predicted / row.count).toFixed(4)),
      observedFrequency: Number((row.actual / row.count).toFixed(4)),
    })),
  };
}
