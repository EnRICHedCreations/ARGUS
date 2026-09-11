import type { Observation, Outcome, Prediction, Signal } from "./types";
import type { Inference } from "./inference";

export type QueryKind = "summary" | "observations" | "signals" | "inferences" | "patterns" | "hypotheses" | "hypothesis_evaluations" | "expectations" | "expectation_outcomes" | "predictions" | "outcomes";
export type QueryInput = { kind: QueryKind; source?: string; limit?: number };
export type QueryMemory = { observations: Observation[]; signals: Signal[]; inferences: Inference[]; patterns:any[]; hypotheses:any[]; hypothesisEvaluations:any[]; expectations:any[]; expectationOutcomes:any[]; predictions:Prediction[]; outcomes:Outcome[] };
function boundedLimit(limit?:number){if(!Number.isFinite(limit))return 25;return Math.max(1,Math.min(100,Math.floor(limit!)));}
export function runStructuredQuery(input:QueryInput,memory:QueryMemory){
 const limit=boundedLimit(input.limit);const source=input.source?.trim();
 const bySource=<T extends {sourceId?:string;subjectScope?:string;scope?:string}>(rows:T[])=>source?rows.filter(row=>row.sourceId===source||row.subjectScope===source||row.scope?.includes(source)):rows;
 if(input.kind==="summary")return{classification:"memory_summary",counts:{observations:memory.observations.length,signals:memory.signals.length,inferences:memory.inferences.length,patterns:memory.patterns.length,hypotheses:memory.hypotheses.length,hypothesisEvaluations:memory.hypothesisEvaluations.length,expectations:memory.expectations.length,expectationOutcomes:memory.expectationOutcomes.length,predictions:memory.predictions.length,outcomes:memory.outcomes.length},openExpectations:memory.expectations.filter(r=>r.status==="open").length,openPredictions:memory.predictions.filter(r=>r.status==="open").length,activeHypotheses:memory.hypotheses.filter(r=>r.status==="active").length,signalKinds:[...new Set(memory.signals.map(r=>r.kind))].sort(),inferenceKinds:[...new Set(memory.inferences.map(r=>r.inferenceType))].sort()};
 if(input.kind==="observations")return{classification:"observed_fact",rows:bySource(memory.observations).slice(0,limit)};
 if(input.kind==="signals")return{classification:"signal",rows:bySource(memory.signals).slice(0,limit)};
 if(input.kind==="inferences")return{classification:"inference",rows:bySource(memory.inferences).slice(0,limit)};
 if(input.kind==="patterns")return{classification:"pattern",rows:bySource(memory.patterns).slice(0,limit)};
 if(input.kind==="hypotheses")return{classification:"hypothesis",rows:memory.hypotheses.slice(0,limit)};
 if(input.kind==="hypothesis_evaluations")return{classification:"hypothesis_evaluation",rows:memory.hypothesisEvaluations.slice(0,limit)};
 if(input.kind==="expectations")return{classification:"expectation",rows:memory.expectations.slice(0,limit)};
 if(input.kind==="expectation_outcomes")return{classification:"expectation_outcome",rows:memory.expectationOutcomes.slice(0,limit)};
 if(input.kind==="predictions")return{classification:"prediction",rows:bySource(memory.predictions).slice(0,limit)};
 return{classification:"outcome",rows:memory.outcomes.slice(0,limit)};
}
