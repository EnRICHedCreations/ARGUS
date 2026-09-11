import type { Observation, Signal } from "./types";

export function detectVolumeSpike(sourceId: string, observations: Observation[], now = new Date()): Signal | null {
  const hour = 60 * 60 * 1000;
  const currentStart = now.getTime() - hour;
  const baselineStart = now.getTime() - 7 * hour;
  const relevant = observations.filter(o => o.sourceId === sourceId);
  const currentEvidence = relevant.filter(o => new Date(o.publishedAt).getTime() >= currentStart);
  const baselineEvents = relevant.filter(o => {
    const t = new Date(o.publishedAt).getTime();
    return t >= baselineStart && t < currentStart;
  });
  const baseline = baselineEvents.length / 6;
  const current = currentEvidence.length;
  if (current < 3 || current <= Math.max(2, baseline * 2)) return null;
  const score = baseline === 0 ? current : current / baseline;

  return {
    id: `volume:${sourceId}:${Math.floor(now.getTime() / hour)}`,
    kind: "volume_spike", sourceId, observedAt: now.toISOString(), score,
    baseline, current, evidenceObservationIds: currentEvidence.map(o => o.id)
  };
}
