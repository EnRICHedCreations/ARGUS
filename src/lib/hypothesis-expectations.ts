import { createHash } from "node:crypto";
import type { ArgusHypothesis } from "./hypotheses";
import type { ArgusPattern } from "./patterns";
import type { Signal } from "./types";

export type HypothesisExpectation = {
  id:string; hypothesisId:string; expectationType:"pattern_persistence"|"cross_source_correlation"|"structural_persistence";
  statement:string; createdAt:string; resolvesAt:string; status:"open"|"resolved"; expectedPolarity:"support"|"contradict"; weight:number; details:Record<string,unknown>;
};
export type HypothesisExpectationOutcome = {
  id:string; expectationId:string; resolvedAt:string; outcome:boolean; evidenceIds:string[]; explanation:string; confidenceDelta:number; modelVersion:"deterministic_expectation_resolver_v1";
};
const plusHours=(iso:string,h:number)=>new Date(Date.parse(iso)+h*3600000).toISOString();
const eid=(h:string,t:string)=>createHash("sha256").update(`hypothesis-expectation\n${h}\n${t}`).digest("hex").slice(0,32);
const clamp=(v:number)=>Math.max(0.03,Math.min(0.97,v));

export function deriveExpectations(hypotheses:ArgusHypothesis[]):HypothesisExpectation[]{
  const out:HypothesisExpectation[]=[];
  for(const h of hypotheses.filter(x=>x.status==="active")){
    const createdAt=h.generatedAt;
    const types=h.hypothesisType==="shared_external_driver"?["pattern_persistence","cross_source_correlation"] as const:h.hypothesisType==="structural_transition"?["pattern_persistence","structural_persistence"] as const:["pattern_persistence"] as const;
    for(const type of types){const positive=h.hypothesisType!=="independent_convergence";out.push({id:eid(h.id,type),hypothesisId:h.id,expectationType:type,statement:type==="cross_source_correlation"?"Cross-source correlation evidence should emerge or persist before the deadline.":type==="structural_persistence"?"Structural-change signals should persist into a subsequent observation cycle.":"The originating pattern scope should recur in a subsequent observation cycle.",createdAt,resolvesAt:plusHours(createdAt,2),status:"open",expectedPolarity:positive?"support":"contradict",weight:type==="pattern_persistence"?0.1:0.08,details:{hypothesisType:h.hypothesisType,competitionGroup:h.competitionGroup}});}
  }
  return out;
}

export function resolveExpectations(expectations:HypothesisExpectation[],patterns:ArgusPattern[],signals:Signal[],nowIso:string):HypothesisExpectationOutcome[]{
  const now=Date.parse(nowIso);const out:HypothesisExpectationOutcome[]=[];
  for(const e of expectations.filter(x=>x.status==="open"&&Date.parse(x.resolvesAt)<=now)){
    const group=String(e.details.competitionGroup??"");const originId=group.startsWith("pattern:")?group.slice(8):"";const origin=patterns.find(p=>p.id===originId);const later=origin?patterns.filter(p=>p.patternType===origin.patternType&&p.scope===origin.scope&&Date.parse(p.detectedAt)>Date.parse(e.createdAt)):[];
    let matched=false;let evidenceIds:string[]=[];
    if(e.expectationType==="pattern_persistence"){matched=later.length>0;evidenceIds=later.map(p=>p.id).slice(0,10);}
    if(e.expectationType==="cross_source_correlation"){const rows=signals.filter(s=>s.kind==="cross_source_correlation"&&Date.parse(s.observedAt)>Date.parse(e.createdAt));matched=rows.length>0;evidenceIds=rows.map(s=>s.id).slice(0,10);}
    if(e.expectationType==="structural_persistence"){const rows=signals.filter(s=>["centrality_shift","co_occurrence","change_point"].includes(s.kind)&&Date.parse(s.observedAt)>Date.parse(e.createdAt));matched=rows.length>=2;evidenceIds=rows.map(s=>s.id).slice(0,10);}
    const supports=e.expectedPolarity==="support"?matched:!matched;const delta=supports?e.weight:-e.weight;
    out.push({id:createHash("sha256").update(`expectation-outcome\n${e.id}`).digest("hex").slice(0,32),expectationId:e.id,resolvedAt:nowIso,outcome:matched,evidenceIds,explanation:`Expectation ${matched?"met":"not met"}; this ${supports?"supports":"contradicts"} the parent hypothesis.`,confidenceDelta:delta,modelVersion:"deterministic_expectation_resolver_v1"});
  }
  return out;
}

export function applyExpectationOutcomes(hypotheses:ArgusHypothesis[],expectations:HypothesisExpectation[],outcomes:HypothesisExpectationOutcome[]):ArgusHypothesis[]{
  const expectationById=new Map(expectations.map(e=>[e.id,e]));const deltaByHypothesis=new Map<string,number>();
  for(const o of outcomes){const e=expectationById.get(o.expectationId);if(!e)continue;deltaByHypothesis.set(e.hypothesisId,(deltaByHypothesis.get(e.hypothesisId)??0)+o.confidenceDelta);}
  return hypotheses.map(h=>{const delta=deltaByHypothesis.get(h.id)??0;if(!delta)return h;const confidence=clamp(h.confidence+delta);const contradictionAdd=delta<0?Math.abs(delta):0;const supportAdd=delta>0?delta:0;return {...h,confidence,status:confidence<=0.05&&contradictionAdd>=0.08?"falsified":"active",supportScore:h.supportScore+supportAdd,contradictionScore:h.contradictionScore+contradictionAdd,details:{...h.details,lastExpectationUpdate:`${delta>=0?"+":""}${delta.toFixed(3)} confidence from resolved expectations`}};});
}
