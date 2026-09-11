import { createHash } from "node:crypto";
import type { Observation, Signal } from "./types";

export type AnalystEvidence = {
  entityLinks: Array<{ observationId: string; entityId: string }>;
  relationships: Array<{ id: string; subjectEntityId: string; objectEntityId?: string; objectEventId?: string; relationshipType: string; validFrom: string; evidenceObservationIds: string[] }>;
};

const HOUR = 60 * 60 * 1000;

function signalId(kind: Signal["kind"], scope: string, now: Date) {
  const bucket = Math.floor(now.getTime() / HOUR);
  return createHash("sha256").update(`${kind}\n${scope}\n${bucket}`).digest("hex").slice(0, 32);
}

function mean(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function sd(values: number[]) { if (values.length < 2) return 0; const m = mean(values); return Math.sqrt(mean(values.map(v => (v - m) ** 2))); }
function words(text: string) { return text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []; }

function hourlyCounts(sourceId: string, observations: Observation[], now: Date, hours = 8) {
  const counts = Array.from({ length: hours }, () => 0);
  for (const observation of observations) {
    if (observation.sourceId !== sourceId) continue;
    const age = now.getTime() - new Date(observation.publishedAt).getTime();
    if (age < 0 || age >= hours * HOUR) continue;
    counts[Math.floor(age / HOUR)] += 1;
  }
  return counts;
}

function detectZScore(sourceId: string, observations: Observation[], now: Date): Signal | null {
  const counts = hourlyCounts(sourceId, observations, now);
  const current = counts[0];
  const history = counts.slice(1);
  const baseline = mean(history);
  const sigma = sd(history);
  const score = sigma === 0 ? (current > baseline ? current - baseline : 0) : (current - baseline) / sigma;
  if (current < 3 || score < 2) return null;
  const evidence = observations.filter(o => o.sourceId === sourceId && now.getTime() - new Date(o.publishedAt).getTime() < HOUR).map(o => o.id);
  return { id: signalId("z_score", sourceId, now), kind: "z_score", sourceId, observedAt: now.toISOString(), score, baseline, current, evidenceObservationIds: evidence, details: { standardDeviation: sigma, history } };
}

function detectAcceleration(sourceId: string, observations: Observation[], now: Date): Signal | null {
  const counts = hourlyCounts(sourceId, observations, now, 4);
  const current = counts[0];
  const previous = counts[1];
  const prior = counts[2];
  const previousDelta = previous - prior;
  const currentDelta = current - previous;
  const acceleration = currentDelta - previousDelta;
  if (current < 3 || acceleration <= 1) return null;
  const evidence = observations.filter(o => o.sourceId === sourceId && now.getTime() - new Date(o.publishedAt).getTime() < 2 * HOUR).map(o => o.id);
  return { id: signalId("acceleration", sourceId, now), kind: "acceleration", sourceId, observedAt: now.toISOString(), score: acceleration, baseline: previousDelta, current: currentDelta, evidenceObservationIds: evidence, details: { hourlyCounts: counts } };
}

function detectNovelty(sourceId: string, observations: Observation[], now: Date): Signal | null {
  const recent = observations.filter(o => o.sourceId === sourceId && now.getTime() - new Date(o.publishedAt).getTime() < HOUR);
  const historical = observations.filter(o => o.sourceId === sourceId && now.getTime() - new Date(o.publishedAt).getTime() >= HOUR && now.getTime() - new Date(o.publishedAt).getTime() < 7 * 24 * HOUR);
  if (!recent.length || !historical.length) return null;
  const historicalTerms = new Set(historical.flatMap(o => words(`${o.title} ${o.summary}`)));
  const recentTerms = new Set(recent.flatMap(o => words(`${o.title} ${o.summary}`)));
  const novelTerms = [...recentTerms].filter(term => !historicalTerms.has(term));
  const score = recentTerms.size ? novelTerms.length / recentTerms.size : 0;
  if (novelTerms.length < 3 || score < 0.2) return null;
  return { id: signalId("novelty", sourceId, now), kind: "novelty", sourceId, observedAt: now.toISOString(), score, baseline: historicalTerms.size, current: novelTerms.length, evidenceObservationIds: recent.map(o => o.id), details: { novelTerms: novelTerms.slice(0, 25), recentTermCount: recentTerms.size } };
}

function detectCoOccurrence(evidence: AnalystEvidence, now: Date): Signal[] {
  const recent = evidence.relationships.filter(r => r.relationshipType === "co_occurs_with" && now.getTime() - new Date(r.validFrom).getTime() < 24 * HOUR);
  const grouped = new Map<string, typeof recent>();
  for (const relation of recent) {
    const key = [relation.subjectEntityId, relation.objectEntityId].filter(Boolean).sort().join(":");
    if (!key) continue;
    const arr = grouped.get(key) ?? [];
    arr.push(relation);
    grouped.set(key, arr);
  }
  return [...grouped.entries()].filter(([, rows]) => rows.length >= 2).map(([pair, rows]) => ({
    id: signalId("co_occurrence", pair, now), kind: "co_occurrence" as const, sourceId: "graph", observedAt: now.toISOString(), score: rows.length, baseline: 1, current: rows.length,
    evidenceObservationIds: [...new Set(rows.flatMap(r => r.evidenceObservationIds))], details: { entityPair: pair, relationshipCount24h: rows.length },
  }));
}

function detectCentralityShift(evidence: AnalystEvidence, now: Date): Signal[] {
  const degree = (from: number, to: number) => {
    const counts = new Map<string, number>();
    for (const relation of evidence.relationships) {
      const t = new Date(relation.validFrom).getTime();
      if (t < from || t >= to) continue;
      counts.set(relation.subjectEntityId, (counts.get(relation.subjectEntityId) ?? 0) + 1);
      if (relation.objectEntityId) counts.set(relation.objectEntityId, (counts.get(relation.objectEntityId) ?? 0) + 1);
    }
    return counts;
  };
  const current = degree(now.getTime() - 24 * HOUR, now.getTime());
  const previous = degree(now.getTime() - 48 * HOUR, now.getTime() - 24 * HOUR);
  const signals: Signal[] = [];
  for (const [entityId, currentDegree] of current) {
    const baseline = previous.get(entityId) ?? 0;
    const shift = currentDegree - baseline;
    if (currentDegree < 2 || shift < 2) continue;
    const related = evidence.relationships.filter(r => r.subjectEntityId === entityId || r.objectEntityId === entityId);
    signals.push({ id: signalId("centrality_shift", entityId, now), kind: "centrality_shift", sourceId: "graph", observedAt: now.toISOString(), score: shift, baseline, current: currentDegree, evidenceObservationIds: [...new Set(related.flatMap(r => r.evidenceObservationIds))], details: { entityId } });
  }
  return signals;
}

function detectChangePoint(sourceId: string, observations: Observation[], now: Date): Signal | null {
  const counts = hourlyCounts(sourceId, observations, now, 8);
  const recentMean = mean(counts.slice(0, 2));
  const previousMean = mean(counts.slice(2, 8));
  const delta = Math.abs(recentMean - previousMean);
  const score = previousMean === 0 ? delta : delta / Math.max(previousMean, 0.25);
  if (recentMean < 2 || score < 1.5) return null;
  const evidence = observations.filter(o => o.sourceId === sourceId && now.getTime() - new Date(o.publishedAt).getTime() < 2 * HOUR).map(o => o.id);
  return { id: signalId("change_point", sourceId, now), kind: "change_point", sourceId, observedAt: now.toISOString(), score, baseline: previousMean, current: recentMean, evidenceObservationIds: evidence, details: { hourlyCounts: counts } };
}

function detectCrossSourceCorrelation(observations: Observation[], now: Date): Signal | null {
  const bySource = new Map<string, Observation[]>();
  for (const observation of observations) {
    if (now.getTime() - new Date(observation.publishedAt).getTime() >= HOUR) continue;
    const arr = bySource.get(observation.sourceId) ?? [];
    arr.push(observation);
    bySource.set(observation.sourceId, arr);
  }
  const active = [...bySource.entries()].filter(([, rows]) => rows.length >= 2);
  if (active.length < 2) return null;
  const counts = active.map(([, rows]) => rows.length);
  const sourceIds = active.map(([sourceId]) => sourceId).sort();
  return { id: signalId("cross_source_correlation", sourceIds.join(":"), now), kind: "cross_source_correlation", sourceId: "multi-source", observedAt: now.toISOString(), score: active.length, baseline: 1, current: mean(counts), evidenceObservationIds: active.flatMap(([, rows]) => rows.map(o => o.id)), details: { sourceIds, counts } };
}

export function runAnalyst(observations: Observation[], evidence: AnalystEvidence, now = new Date()): Signal[] {
  const sourceIds = [...new Set(observations.map(o => o.sourceId))];
  const signals: Signal[] = [];
  for (const sourceId of sourceIds) {
    for (const signal of [detectZScore(sourceId, observations, now), detectAcceleration(sourceId, observations, now), detectNovelty(sourceId, observations, now), detectChangePoint(sourceId, observations, now)]) {
      if (signal) signals.push(signal);
    }
  }
  signals.push(...detectCoOccurrence(evidence, now));
  signals.push(...detectCentralityShift(evidence, now));
  const correlation = detectCrossSourceCorrelation(observations, now);
  if (correlation) signals.push(correlation);
  return signals;
}
