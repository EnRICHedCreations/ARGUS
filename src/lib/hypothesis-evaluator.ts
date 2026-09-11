import { createHash } from "node:crypto";
import type { Signal } from "./types";
import type { ArgusPattern } from "./patterns";
import type { ArgusHypothesis } from "./hypotheses";

export type HypothesisEvaluation = {
  id:string; hypothesisId:string; evaluatedAt:string; priorConfidence:number; posteriorConfidence:number;
  supportDelta:number; contradictionDelta:number; status:"active"|"strengthened"|"weakened"|"falsified";
  supportingEvidence:Array<{type:"signal"|"pattern";id:string;reason:string;weight:number}>;
  contradictingEvidence:Array<{type:"signal"|"pattern";id:string;reason:string;weight:number}>;
  explanation:string; modelVersion:"deterministic_hypothesis_evaluator_v1";
};

const clamp=(v:number)=>Math.max(0.03,Math.min(0.97,v));
const domain=(s:string)=>s.startsWith("nws-")||s.startsWith("nhc-")?"weather":s.startsWith("usgs-")?"geophysical":s.startsWith("cisa-")?"cybersecurity":s.startsWith("fed-")?"monetary_policy":s.startsWith("github-")?"technology":s.startsWith("nasa-")?"space_science":s.split("-")[0]||s;

export function evaluateHypotheses(hypotheses:ArgusHypothesis[], currentPatterns:ArgusPattern[], historicalPatterns:ArgusPattern[], signals:Signal[]) {
  const evaluations:HypothesisEvaluation[]=[];
  const updated:ArgusHypothesis[]=[];
  const signalById=new Map(signals.map(s=>[s.id,s]));
  for(const h of hypotheses){
    const p=currentPatterns.find(x=>h.competitionGroup===`pattern:${x.id}`);
    if(!p){updated.push(h);continue;}
    const prior=h.confidence;
    const support:Array<{type:"signal"|"pattern";id:string;reason:string;weight:number}>=[];
    const contradict:Array<{type:"signal"|"pattern";id:string;reason:string;weight:number}>=[];
    const evidenceSignals=p.evidenceSignalIds.map(id=>signalById.get(id)).filter((x):x is Signal=>Boolean(x));
    const domains=new Set(evidenceSignals.map(s=>domain(s.sourceId)));
    const historicalMatches=historicalPatterns.filter(x=>x.patternType===p.patternType&&x.scope===p.scope&&x.detectedAt<p.detectedAt);
    const cross=evidenceSignals.filter(s=>s.kind==="cross_source_correlation");
    const structural=evidenceSignals.filter(s=>["centrality_shift","co_occurrence","change_point"].includes(s.kind));

    if(h.hypothesisType==="shared_external_driver"){
      if(domains.size>=2) support.push({type:"pattern",id:p.id,reason:`${domains.size} independent domains are concurrently active`,weight:0.08});
      cross.forEach(s=>support.push({type:"signal",id:s.id,reason:"cross-source correlation supports a shared driver",weight:0.07}));
      if(historicalMatches.length) support.push({type:"pattern",id:historicalMatches[0].id,reason:"same cross-domain scope persisted across observation cycles",weight:0.06});
      if(!cross.length&&historicalMatches.length) contradict.push({type:"pattern",id:p.id,reason:"convergence persisted without cross-source correlation evidence",weight:0.05});
    } else if(h.hypothesisType==="structural_transition"){
      structural.forEach(s=>support.push({type:"signal",id:s.id,reason:`${s.kind} is consistent with structural change`,weight:0.04}));
      if(historicalMatches.length) support.push({type:"pattern",id:historicalMatches[0].id,reason:"structural pattern persisted across observation cycles",weight:0.08});
      if(structural.length<2) contradict.push({type:"pattern",id:p.id,reason:"fewer than two structural detectors remain active",weight:0.12});
    } else {
      if(historicalMatches.length) contradict.push({type:"pattern",id:historicalMatches[0].id,reason:"repeated same-scope convergence weakens the coincidence explanation",weight:0.10});
      cross.forEach(s=>contradict.push({type:"signal",id:s.id,reason:"cross-source correlation contradicts purely independent convergence",weight:0.08}));
      if(!historicalMatches.length&&!cross.length) support.push({type:"pattern",id:p.id,reason:"no persistence or cross-source correlation has yet emerged",weight:0.05});
    }
    const supportDelta=support.reduce((n,e)=>n+e.weight,0), contradictionDelta=contradict.reduce((n,e)=>n+e.weight,0);
    const posterior=clamp(prior+supportDelta-contradictionDelta);
    const status:HypothesisEvaluation["status"]=posterior<=0.08&&contradictionDelta>=0.15?"falsified":posterior>prior+0.025?"strengthened":posterior<prior-0.025?"weakened":"active";
    const evaluatedAt=p.detectedAt;
    const id=createHash("sha256").update(`hypothesis-evaluation\n${h.id}\n${evaluatedAt}`).digest("hex").slice(0,32);
    const explanation=`Evidence review: +${supportDelta.toFixed(3)} support, -${contradictionDelta.toFixed(3)} contradiction; confidence ${prior.toFixed(3)} → ${posterior.toFixed(3)}.`;
    evaluations.push({id,hypothesisId:h.id,evaluatedAt,priorConfidence:prior,posteriorConfidence:posterior,supportDelta,contradictionDelta,status,supportingEvidence:support,contradictingEvidence:contradict,explanation,modelVersion:"deterministic_hypothesis_evaluator_v1"});
    updated.push({...h,confidence:posterior,status:status==="falsified"?"falsified":"active",supportScore:h.supportScore+supportDelta,contradictionScore:h.contradictionScore+contradictionDelta,evidence:[...h.evidence,...support.map(e=>({type:e.type,id:e.id,polarity:"support" as const,weight:e.weight})),...contradict.map(e=>({type:e.type,id:e.id,polarity:"contradict" as const,weight:e.weight}))],details:{...h.details,evaluationStatus:status,lastEvaluation:explanation}} as ArgusHypothesis);
  }
  return {hypotheses:updated,evaluations};
}
