import { NextResponse } from "next/server";
import { detectVolumeSpike } from "@/lib/anomaly";
import { runAnalyst, type AnalystEvidence } from "@/lib/analyst";
import type { Observation, SignalKind } from "@/lib/types";

const HOUR = 60 * 60 * 1000;
const EXPECTED: SignalKind[] = [
  "volume_spike",
  "z_score",
  "acceleration",
  "novelty",
  "co_occurrence",
  "centrality_shift",
  "change_point",
  "cross_source_correlation",
];

function observation(id: string, sourceId: string, publishedAt: Date, title: string): Observation {
  return {
    id,
    sourceId,
    externalId: id,
    title,
    url: `https://example.invalid/${id}`,
    publishedAt: publishedAt.toISOString(),
    observedAt: publishedAt.toISOString(),
    summary: `${title} deterministic certification fixture`,
    fingerprint: `fixture-${id}`,
  };
}

export async function GET() {
  const now = new Date("2026-01-01T12:00:00.000Z");
  const observations: Observation[] = [];

  // Source A: strong current-hour burst, sparse history, and novel terms.
  for (let i = 0; i < 6; i++) observations.push(observation(`a-now-${i}`, "source-a", new Date(now.getTime() - (10 + i * 5) * 60_000), `Quantum Glacier Beacon ${i}`));
  observations.push(observation("a-h1", "source-a", new Date(now.getTime() - 90 * 60_000), "Legacy Archive Baseline"));
  observations.push(observation("a-h3", "source-a", new Date(now.getTime() - 3 * HOUR - 10 * 60_000), "Legacy Archive Baseline"));
  observations.push(observation("a-h5", "source-a", new Date(now.getTime() - 5 * HOUR - 10 * 60_000), "Legacy Archive Baseline"));
  observations.push(observation("a-h7", "source-a", new Date(now.getTime() - 7 * HOUR - 10 * 60_000), "Legacy Archive Baseline"));

  // Source B: enough simultaneous activity to certify cross-source correlation.
  for (let i = 0; i < 3; i++) observations.push(observation(`b-now-${i}`, "source-b", new Date(now.getTime() - (15 + i * 7) * 60_000), `Secondary Signal ${i}`));

  const evidence: AnalystEvidence = {
    entityLinks: [],
    relationships: [
      { id: "r1", subjectEntityId: "entity-a", objectEntityId: "entity-b", relationshipType: "co_occurs_with", validFrom: new Date(now.getTime() - 2 * HOUR).toISOString(), evidenceObservationIds: ["a-now-0"] },
      { id: "r2", subjectEntityId: "entity-a", objectEntityId: "entity-b", relationshipType: "co_occurs_with", validFrom: new Date(now.getTime() - HOUR).toISOString(), evidenceObservationIds: ["a-now-1"] },
      { id: "r3", subjectEntityId: "entity-a", objectEventId: "a-now-2", relationshipType: "mentioned_in", validFrom: new Date(now.getTime() - 30 * 60_000).toISOString(), evidenceObservationIds: ["a-now-2"] },
    ],
  };

  const analystSignals = runAnalyst(observations, evidence, now);
  const volume = detectVolumeSpike("source-a", observations, now);
  const observedKinds = [...new Set([...(volume ? [volume.kind] : []), ...analystSignals.map(signal => signal.kind)])].sort();
  const missingKinds = EXPECTED.filter(kind => !observedKinds.includes(kind));

  return NextResponse.json({
    certification: "gate4_multi_detector_runtime",
    sideEffects: "none",
    llmProvider: process.env.LLM_PROVIDER ?? "none",
    expectedKinds: EXPECTED,
    observedKinds,
    missingKinds,
    pass: missingKinds.length === 0,
  });
}
