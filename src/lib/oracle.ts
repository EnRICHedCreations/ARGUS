import { createHash } from "node:crypto";
import type { Prediction, Signal } from "./types";
import { domainFor } from "./patterns";

const HOUR=60*60*1000;
function idFor(scope:string,predictedAt:string){const bucket=Math.floor(new Date(predictedAt).getTime()/(6*HOUR));return createHash("sha256").update(`prediction\ncross_domain_follow_through\n${scope}\n${bucket}`).digest("hex").slice(0,32);}

// Oracle v2 deliberately refuses low-value single-feed forecasts. A prediction must be
// supported by several signal methods across several independent domains and make a
// falsifiable claim about cross-domain follow-through.
export function generatePredictions(signals:Signal[],now=new Date()):Prediction[]{
 const cutoff=now.getTime()-2*HOUR;const recent=signals.filter(s=>Date.parse(s.observedAt)>=cutoff&&s.score>=1&&s.sourceId!=="graph"&&s.sourceId!=="multi-source");
 const domains=new Map<string,Signal[]>();for(const s of recent){const d=domainFor(s.sourceId);const rows=domains.get(d)??[];rows.push(s);domains.set(d,rows);}const active=[...domains.entries()].filter(([,rows])=>new Set(rows.map(r=>r.kind)).size>=2).sort((a,b)=>Math.max(...b[1].map(x=>x.score))-Math.max(...a[1].map(x=>x.score)));
 if(active.length<3)return[];
 const chosen=active.slice(0,5);const selected=chosen.flatMap(([,rows])=>rows.sort((a,b)=>b.score-a.score).slice(0,3));const kinds=new Set(selected.map(s=>s.kind));const sourceIds=new Set(selected.map(s=>s.sourceId));
 // Significance gate: multi-method, multi-source, multi-domain. Silence is preferable to trivia.
 if(kinds.size<3||sourceIds.size<3)return[];
 const scope=chosen.map(([d])=>d).sort().join("+");const predictedAt=now.toISOString();const horizonHours=12;const resolvesAt=new Date(now.getTime()+horizonHours*HOUR).toISOString();const strongest=Math.max(...selected.map(s=>s.score));const probability=Math.min(.82,.55+Math.min(.12,(chosen.length-3)*.04)+Math.min(.08,(kinds.size-3)*.02)+Math.min(.07,Math.log10(Math.max(1,strongest))*.04));
 return [{id:idFor(scope,predictedAt),predictionType:"cross_domain_follow_through",subjectScope:scope,statement:`Within the next ${horizonHours} hours, at least ${Math.min(3,chosen.length)} of the currently converging domains (${chosen.map(([d])=>d).join(", ")}) will produce fresh elevated signals, indicating that the convergence persisted beyond this observation cycle.`,predictedAt,horizonHours,resolvesAt,probability:Number(probability.toFixed(4)),status:"open",modelVersion:"deterministic_oracle_v2",evidenceSignalIds:selected.map(s=>s.id),evidenceObservationIds:[...new Set(selected.flatMap(s=>s.evidenceObservationIds))].slice(0,250),details:{requiredDomains:Math.min(3,chosen.length),domains:chosen.map(([d])=>d),sourceIds:[...sourceIds],signalKinds:[...kinds],significanceGate:"3+ domains, 3+ sources, 3+ detector kinds, score>=1",strongestSignalScore:strongest}}];
}
