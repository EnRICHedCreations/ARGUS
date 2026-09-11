import { createHash } from "node:crypto";
import type { Signal } from "./types";

export type ArgusPattern = {
  id: string;
  patternType: "cross_domain_convergence" | "structural_shift_cluster" | "temporal_sequence_cluster" | "regional_recurrence_cluster";
  detectedAt: string;
  scope: string;
  score: number;
  statement: string;
  evidenceSignalIds: string[];
  evidenceObservationIds: string[];
  details: Record<string, unknown>;
  modelVersion: "deterministic_pattern_v1" | "deterministic_temporal_pattern_v1";
};

export const domainFor = (sourceId: string) => {
  if (sourceId.startsWith("nws-") || sourceId.startsWith("nhc-")) return "weather";
  if (sourceId.startsWith("usgs-")) return "geophysical";
  if (sourceId.startsWith("cisa-") || sourceId.startsWith("arxiv-crypto")) return "cybersecurity";
  if (sourceId.startsWith("fed-") || sourceId.startsWith("eia-")) return "economy_energy";
  if (sourceId.startsWith("sec-")) return "corporate_regulatory";
  if (sourceId.startsWith("whitehouse-") || sourceId.startsWith("doj-")) return "government_policy";
  if (sourceId.startsWith("github-") || sourceId.startsWith("hackernews-")) return "technology_attention";
  if (sourceId.startsWith("arxiv-")) return "research";
  if (sourceId.startsWith("nasa-")) return "space_science";
  return sourceId.split("-")[0] || sourceId;
};

function idFor(type: ArgusPattern["patternType"], bucket: string, keys: string[]) {return createHash("sha256").update(`pattern\n${type}\n${bucket}\n${keys.sort().join("|")}`).digest("hex").slice(0, 32);}

export function derivePatterns(signals: Signal[]): ArgusPattern[] {
  if (!signals.length) return [];
  const recent=[...signals].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)).slice(0,160);const latestMs=Math.max(...recent.map(s=>Date.parse(s.observedAt)));const windowed=recent.filter(s=>latestMs-Date.parse(s.observedAt)<=2*60*60*1000);const bucket=new Date(latestMs).toISOString().slice(0,13);const patterns:ArgusPattern[]=[];
  const byDomain=new Map<string,Signal[]>();for(const signal of windowed){const domain=domainFor(signal.sourceId);const rows=byDomain.get(domain)??[];rows.push(signal);byDomain.set(domain,rows);}const activeDomains=[...byDomain.entries()].filter(([,rows])=>rows.some(r=>r.score>=1));
  if(activeDomains.length>=2){const chosen=activeDomains.flatMap(([,rows])=>rows.sort((a,b)=>b.score-a.score).slice(0,2));const domains=activeDomains.map(([d])=>d).sort();const evidenceObservationIds=[...new Set(chosen.flatMap(s=>s.evidenceObservationIds))].slice(0,200);const score=Number((chosen.reduce((sum,s)=>sum+Math.max(0,s.score),0)/Math.max(1,chosen.length)).toFixed(4));patterns.push({id:idFor("cross_domain_convergence",bucket,chosen.map(s=>s.id)),patternType:"cross_domain_convergence",detectedAt:new Date(latestMs).toISOString(),scope:domains.join("+"),score,statement:`Concurrent elevated activity is present across ${domains.join(", ")} domains within a two-hour window.`,evidenceSignalIds:chosen.map(s=>s.id),evidenceObservationIds,details:{domains,domainCount:domains.length,sourceIds:[...new Set(chosen.map(s=>s.sourceId))]},modelVersion:"deterministic_pattern_v1"});}
  const structuralKinds=new Set(["centrality_shift","co_occurrence","change_point","cross_source_correlation"]);const structural=windowed.filter(s=>structuralKinds.has(s.kind));if(structural.length>=2){const chosen=structural.sort((a,b)=>b.score-a.score).slice(0,8);patterns.push({id:idFor("structural_shift_cluster",bucket,chosen.map(s=>s.id)),patternType:"structural_shift_cluster",detectedAt:new Date(latestMs).toISOString(),scope:[...new Set(chosen.map(s=>domainFor(s.sourceId)))].sort().join("+"),score:Number((chosen.reduce((sum,s)=>sum+Math.max(0,s.score),0)/chosen.length).toFixed(4)),statement:"Multiple structural-change detectors are firing in the current world model, indicating an unusual reconfiguration rather than a simple volume increase.",evidenceSignalIds:chosen.map(s=>s.id),evidenceObservationIds:[...new Set(chosen.flatMap(s=>s.evidenceObservationIds))].slice(0,200),details:{kinds:[...new Set(chosen.map(s=>s.kind))],sourceIds:[...new Set(chosen.map(s=>s.sourceId))]},modelVersion:"deterministic_pattern_v1"});}return patterns;
}
