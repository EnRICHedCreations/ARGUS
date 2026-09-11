import type { ArgusPattern } from "./patterns";
import type { ArgusHypothesis } from "./hypotheses";
import type { HypothesisEvaluation } from "./hypothesis-evaluator";

function config(){const url=process.env.SUPABASE_URL?.replace(/\/$/,"");const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("ARGUS persistent memory requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");return{url,key};}
async function request(path:string,method="GET",body?:unknown,prefer?:string){const{url,key}=config();const r=await fetch(`${url}/rest/v1/${path}`,{method,cache:"no-store",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(prefer?{Prefer:prefer}:{})},body:body==null?undefined:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw new Error(`ARGUS reasoning memory failed (${r.status}): ${text.slice(0,500)}`);return text.trim()?JSON.parse(text):null;}

export async function rememberPatterns(patterns:ArgusPattern[]){if(!patterns.length)return;await request("argus_patterns?on_conflict=id","POST",patterns.map(p=>({id:p.id,pattern_type:p.patternType,detected_at:p.detectedAt,scope:p.scope,score:p.score,statement:p.statement,evidence_signal_ids:p.evidenceSignalIds,evidence_observation_ids:p.evidenceObservationIds,details:p.details,model_version:p.modelVersion})),"resolution=merge-duplicates,return=minimal");}
export async function rememberHypotheses(hypotheses:ArgusHypothesis[]){if(!hypotheses.length)return;await request("argus_hypotheses?on_conflict=id","POST",hypotheses.map(h=>({id:h.id,competition_group:h.competitionGroup,hypothesis_type:h.hypothesisType,statement:h.statement,generated_at:h.generatedAt,confidence:h.confidence,rank:h.rank,status:h.status,support_score:h.supportScore,contradiction_score:h.contradictionScore,expected_evidence:h.expectedEvidence,falsifiers:h.falsifiers,details:h.details,model_version:h.modelVersion})),"resolution=merge-duplicates,return=minimal");const evidence=hypotheses.flatMap(h=>h.evidence.map(e=>({hypothesis_id:h.id,evidence_type:e.type,evidence_id:e.id,polarity:e.polarity,weight:e.weight})));if(evidence.length)await request("argus_hypothesis_evidence?on_conflict=hypothesis_id,evidence_type,evidence_id,polarity","POST",evidence,"resolution=ignore-duplicates,return=minimal");}
export async function rememberHypothesisEvaluations(rows:HypothesisEvaluation[]){if(!rows.length)return;await request("argus_hypothesis_evaluations?on_conflict=id","POST",rows.map(e=>({id:e.id,hypothesis_id:e.hypothesisId,evaluated_at:e.evaluatedAt,prior_confidence:e.priorConfidence,posterior_confidence:e.posteriorConfidence,support_delta:e.supportDelta,contradiction_delta:e.contradictionDelta,status:e.status,supporting_evidence:e.supportingEvidence,contradicting_evidence:e.contradictingEvidence,explanation:e.explanation,model_version:e.modelVersion})),"resolution=ignore-duplicates,return=minimal");}

export async function getPatterns():Promise<ArgusPattern[]>{
  const rows=(await request("argus_patterns?select=*&order=detected_at.desc&limit=500")??[]) as Array<Record<string,unknown>>;
  return rows.map(r=>({
    id:String(r.id),
    patternType:String(r.pattern_type) as ArgusPattern["patternType"],
    detectedAt:String(r.detected_at),
    scope:String(r.scope),
    score:Number(r.score),
    statement:String(r.statement),
    evidenceSignalIds:Array.isArray(r.evidence_signal_ids)?r.evidence_signal_ids.map(String):[],
    evidenceObservationIds:Array.isArray(r.evidence_observation_ids)?r.evidence_observation_ids.map(String):[],
    details:r.details&&typeof r.details==="object"?r.details as Record<string,unknown>:{},
    modelVersion:"deterministic_pattern_v1",
  }));
}

export async function getHypotheses():Promise<ArgusHypothesis[]>{
  const rows=(await request("argus_hypotheses?select=*&order=generated_at.desc,competition_group.asc,rank.asc&limit=1000")??[]) as Array<Record<string,unknown>>;
  return rows.map(r=>({
    id:String(r.id),competitionGroup:String(r.competition_group),
    hypothesisType:String(r.hypothesis_type) as ArgusHypothesis["hypothesisType"],
    statement:String(r.statement),generatedAt:String(r.generated_at),confidence:Number(r.confidence),rank:Number(r.rank),
    status:(String(r.status)==="falsified"?"falsified":"active") as ArgusHypothesis["status"],
    supportScore:Number(r.support_score),contradictionScore:Number(r.contradiction_score),
    expectedEvidence:Array.isArray(r.expected_evidence)?r.expected_evidence.map(String):[],
    falsifiers:Array.isArray(r.falsifiers)?r.falsifiers.map(String):[],
    evidence:[],
    details:r.details&&typeof r.details==="object"?r.details as Record<string,unknown>:{},
    modelVersion:"deterministic_hypothesis_v1",
  }));
}

export async function getHypothesisEvaluations():Promise<HypothesisEvaluation[]>{
  const rows=(await request("argus_hypothesis_evaluations?select=*&order=evaluated_at.desc&limit=1000")??[]) as Array<Record<string,unknown>>;
  return rows.map(r=>({
    id:String(r.id),hypothesisId:String(r.hypothesis_id),evaluatedAt:String(r.evaluated_at),
    priorConfidence:Number(r.prior_confidence),posteriorConfidence:Number(r.posterior_confidence),
    supportDelta:Number(r.support_delta),contradictionDelta:Number(r.contradiction_delta),
    status:String(r.status) as HypothesisEvaluation["status"],
    supportingEvidence:Array.isArray(r.supporting_evidence)?r.supporting_evidence as HypothesisEvaluation["supportingEvidence"]:[],
    contradictingEvidence:Array.isArray(r.contradicting_evidence)?r.contradicting_evidence as HypothesisEvaluation["contradictingEvidence"]:[],
    explanation:String(r.explanation),modelVersion:"deterministic_hypothesis_evaluator_v1",
  }));
}
