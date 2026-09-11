import { NextResponse } from "next/server";
import { runStructuredQuery } from "@/lib/query";
import type { Inference } from "@/lib/inference";
import type { Observation, Outcome, Prediction, Signal } from "@/lib/types";
import type { SemanticDevelopment } from "@/lib/semantic-intelligence";

export async function GET() {
  const observation: Observation = { id: "o1", sourceId: "fixture", externalId: "e1", title: "Fixture event", url: "https://example.com/e1", publishedAt: "2026-01-01T00:00:00.000Z", observedAt: "2026-01-01T00:01:00.000Z", summary: "fixture", fingerprint: "f1" };
  const signal: Signal = { id: "s1", kind: "novelty", sourceId: "fixture", observedAt: "2026-01-01T00:02:00.000Z", score: 2, baseline: 1, current: 2, evidenceObservationIds: ["o1"] };
  const inference: Inference = { id: "i1", signalId: "s1", inferenceType: "novelty", subjectScope: "fixture", statement: "Fixture inference", inferredAt: "2026-01-01T00:02:00.000Z", confidence: 0.7, derivationMethod: "deterministic_signal_interpretation_v1", evidenceObservationIds: ["o1"], details: {} };
  const pattern = { id:"pt1", patternType:"cross_domain_convergence", detectedAt:"2026-01-01T00:02:00.000Z", scope:"fixture+other", score:2, statement:"Fixture pattern", evidenceSignalIds:["s1"], evidenceObservationIds:["o1"], details:{}, modelVersion:"deterministic_pattern_v1" };
  const semanticDevelopment: SemanticDevelopment = { id:"sd1",entityId:"entity-fixture",entityName:"Fixture Corp",entityType:"company",detectedAt:"2026-01-01T00:02:00.000Z",domainCount:2,sourceCount:2,observationCount:2,novelty:1,specificity:.95,consequenceScore:.95,consequenceClass:"regulatory_enforcement",targetDomains:["markets_regulation","government_policy"],score:12,domains:["markets_regulation","government_policy"],sourceIds:["fixture","other"],statement:"Fixture Corp: unusual cross-domain activity.",rationale:"Fixture semantic development",evidenceObservationIds:["o1"],modelVersion:"deterministic_semantic_convergence_v2" };
  const hypothesis = { id:"h1", competitionGroup:"pattern:pt1", hypothesisType:"shared_external_driver", statement:"Fixture hypothesis", generatedAt:"2026-01-01T00:02:00.000Z", confidence:0.6, rank:1, status:"active", supportScore:2, contradictionScore:0, expectedEvidence:["fixture"], falsifiers:["fixture"], details:{}, modelVersion:"deterministic_hypothesis_v1" };
  const hypothesisEvaluation={id:"he1",hypothesisId:"h1",evaluatedAt:"2026-01-01T00:05:00.000Z",priorConfidence:0.6,posteriorConfidence:0.7,status:"strengthened"};
  const expectation={id:"ex1",hypothesisId:"h1",expectationType:"pattern_persistence",statement:"Fixture expectation",createdAt:"2026-01-01T00:05:00.000Z",resolvesAt:"2026-01-01T02:05:00.000Z",status:"open",expectedPolarity:"support",weight:0.1,details:{}};
  const expectationOutcome={id:"exo1",expectationId:"ex1",resolvedAt:"2026-01-01T02:06:00.000Z",outcome:true,confidenceDelta:0.1};
  const prediction: Prediction = { id: "p1", predictionType: "source_activity_elevated", subjectScope: "fixture", statement: "Fixture prediction", predictedAt: "2026-01-01T00:03:00.000Z", horizonHours: 1, resolvesAt: "2026-01-01T01:03:00.000Z", probability: 0.7, status: "resolved", modelVersion: "deterministic_oracle_v1", evidenceSignalIds: ["s1"], evidenceObservationIds: ["o1"], details: { threshold: 1 } };
  const outcome: Outcome = { id: "r1", predictionId: "p1", resolvedAt: "2026-01-01T01:04:00.000Z", outcome: true, actualValue: 1, targetValue: 1, brierScore: 0.09, absoluteError: 0, resolutionMethod: "deterministic_source_activity_v1", evidenceObservationIds: ["o1"], details: {} };
  const memory = { observations:[observation], signals:[signal], inferences:[inference], patterns:[pattern], semanticDevelopments:[semanticDevelopment], hypotheses:[hypothesis], hypothesisEvaluations:[hypothesisEvaluation], expectations:[expectation], expectationOutcomes:[expectationOutcome], predictions:[prediction], outcomes:[outcome] };
  const kinds = ["summary","observations","signals","inferences","patterns","semantic_developments","hypotheses","hypothesis_evaluations","expectations","expectation_outcomes","predictions","outcomes"] as const;
  const results = kinds.map(kind => ({ kind, result: runStructuredQuery({ kind, source: ["outcomes","hypotheses","hypothesis_evaluations","expectations","expectation_outcomes","semantic_developments"].includes(kind) ? undefined : "fixture", limit: 5 }, memory) }));
  const classifications = results.map(row => (row.result as { classification?: string }).classification).filter(Boolean);
  const expected = ["memory_summary","observed_fact","signal","inference","pattern","semantic_development","hypothesis","hypothesis_evaluation","expectation","expectation_outcome","prediction","outcome"];
  const pass = expected.every(value => classifications.includes(value));
  return NextResponse.json({ certification:"structured_query_runtime_v4", sideEffects:"none", llmProvider:"none", expectedClassifications:expected, observedClassifications:classifications, pass });
}
