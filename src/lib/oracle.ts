import { createHash } from "node:crypto";
import type { Prediction, Signal } from "./types";

const HOUR = 60 * 60 * 1000;

function predictionId(sourceId: string, predictedAt: string) {
  const bucket = Math.floor(new Date(predictedAt).getTime() / HOUR);
  return createHash("sha256").update(`prediction\nsource_activity_elevated\n${sourceId}\n${bucket}`).digest("hex").slice(0, 32);
}

export function generatePredictions(signals: Signal[], now = new Date()): Prediction[] {
  const qualifyingKinds = new Set<Signal["kind"]>(["volume_spike", "z_score", "acceleration", "change_point"]);
  const bySource = new Map<string, Signal[]>();
  for (const signal of signals) {
    if (!qualifyingKinds.has(signal.kind) || signal.sourceId === "graph" || signal.sourceId === "multi-source") continue;
    const rows = bySource.get(signal.sourceId) ?? [];
    rows.push(signal);
    bySource.set(signal.sourceId, rows);
  }

  const predictions: Prediction[] = [];
  for (const [sourceId, rows] of bySource) {
    const strongest = [...rows].sort((a, b) => b.score - a.score)[0];
    const threshold = Math.max(3, Math.ceil(strongest.current * 0.5));
    const support = Math.min(0.2, Math.max(0, rows.length - 1) * 0.05);
    const probability = Math.min(0.85, 0.6 + Math.min(0.15, Math.log10(Math.max(strongest.score, 1)) * 0.08) + support);
    const predictedAt = now.toISOString();
    const resolvesAt = new Date(now.getTime() + HOUR).toISOString();
    predictions.push({
      id: predictionId(sourceId, predictedAt),
      predictionType: "source_activity_elevated",
      subjectScope: sourceId,
      statement: `During the next 1 hour, source ${sourceId} will publish at least ${threshold} observations.`,
      predictedAt,
      horizonHours: 1,
      resolvesAt,
      probability: Number(probability.toFixed(4)),
      status: "open",
      modelVersion: "deterministic_oracle_v1",
      evidenceSignalIds: rows.map(signal => signal.id),
      evidenceObservationIds: [...new Set(rows.flatMap(signal => signal.evidenceObservationIds))],
      details: {
        threshold,
        strongestSignalKind: strongest.kind,
        strongestSignalScore: strongest.score,
        supportingSignalKinds: [...new Set(rows.map(signal => signal.kind))],
      },
    });
  }
  return predictions;
}
