import { createHash } from "node:crypto";
import type { ArgusPattern } from "./patterns";

export type ArgusHypothesis = {
  id: string;
  competitionGroup: string;
  hypothesisType: "shared_external_driver" | "independent_convergence" | "structural_transition";
  statement: string;
  generatedAt: string;
  confidence: number;
  rank: number;
  status: "active";
  supportScore: number;
  contradictionScore: number;
  expectedEvidence: string[];
  falsifiers: string[];
  evidence: Array<{ type:"pattern"|"signal"|"observation"; id:string; polarity:"support"|"contradict"; weight:number }>;
  details: Record<string, unknown>;
  modelVersion: "deterministic_hypothesis_v1";
};

function hid(group:string,type:string) {
  return createHash("sha256").update(`hypothesis\n${group}\n${type}`).digest("hex").slice(0,32);
}

function clamp(v:number) { return Math.max(0.05,Math.min(0.95,v)); }

export function deriveHypotheses(patterns: ArgusPattern[]): ArgusHypothesis[] {
  const out: ArgusHypothesis[] = [];
  for (const pattern of patterns) {
    const group = `pattern:${pattern.id}`;
    const base = Math.min(0.82,0.35 + Math.log10(1+Math.max(0,pattern.score))*0.18 + Math.min(0.15,pattern.evidenceSignalIds.length*0.02));
    const rows: Array<Omit<ArgusHypothesis,"id"|"rank">> = pattern.patternType === "cross_domain_convergence" ? [
      {
        competitionGroup:group, hypothesisType:"shared_external_driver", statement:`A shared external condition may be contributing to the concurrent activity represented by ${pattern.scope}; current evidence establishes temporal convergence, not causality.`, generatedAt:pattern.detectedAt, confidence:clamp(base), status:"active", supportScore:pattern.score, contradictionScore:0,
        expectedEvidence:["additional independent domains become active in the same temporal window","new graph relationships appear between entities already implicated by the convergent domains","the convergence persists across a subsequent observation cycle"],
        falsifiers:["activity rapidly returns to baseline independently in each domain","no shared entities, locations, or temporal structure emerge after additional observations"],
        evidence:[{type:"pattern",id:pattern.id,polarity:"support",weight:1},...pattern.evidenceSignalIds.map(id=>({type:"signal" as const,id,polarity:"support" as const,weight:0.5}))], details:{patternType:pattern.patternType,scope:pattern.scope}, modelVersion:"deterministic_hypothesis_v1"
      },
      {
        competitionGroup:group, hypothesisType:"independent_convergence", statement:`The concurrent activity across ${pattern.scope} may be coincidental or driven by separate local causes rather than one shared driver.`, generatedAt:pattern.detectedAt, confidence:clamp(0.85-base), status:"active", supportScore:Math.max(0.1,1/(1+pattern.score)), contradictionScore:0,
        expectedEvidence:["subsequent activity diverges by domain","no meaningful cross-domain entity or event links emerge","timing overlap weakens on later observation cycles"],
        falsifiers:["multiple domains continue moving together","shared entities, locations, or event chains connect previously independent domains"],
        evidence:[{type:"pattern",id:pattern.id,polarity:"support",weight:0.4}], details:{patternType:pattern.patternType,scope:pattern.scope}, modelVersion:"deterministic_hypothesis_v1"
      }
    ] : [
      {
        competitionGroup:group, hypothesisType:"structural_transition", statement:"The current cluster of graph and regime-change signals may represent a genuine structural transition in the observed world model rather than transient noise.", generatedAt:pattern.detectedAt, confidence:clamp(base+0.05), status:"active", supportScore:pattern.score, contradictionScore:0,
        expectedEvidence:["centrality or co-occurrence changes persist","new relationships accumulate around the same entities or event classes","subsequent change-point evidence remains directionally consistent"],
        falsifiers:["graph structure reverts on the next cycles","the implicated relationships disappear without additional supporting observations"],
        evidence:[{type:"pattern",id:pattern.id,polarity:"support",weight:1},...pattern.evidenceSignalIds.map(id=>({type:"signal" as const,id,polarity:"support" as const,weight:0.5}))], details:{patternType:pattern.patternType,scope:pattern.scope}, modelVersion:"deterministic_hypothesis_v1"
      },
      {
        competitionGroup:group, hypothesisType:"independent_convergence", statement:"The apparent structural transition may be a short-lived combination of unrelated detector firings rather than one coherent change in the world model.", generatedAt:pattern.detectedAt, confidence:clamp(0.8-base), status:"active", supportScore:Math.max(0.1,1/(1+pattern.score)), contradictionScore:0,
        expectedEvidence:["detectors stop firing together","new evidence fails to reconnect the same entities or sources"], falsifiers:["the same structural pattern persists across subsequent cycles"],
        evidence:[{type:"pattern",id:pattern.id,polarity:"support",weight:0.35}], details:{patternType:pattern.patternType,scope:pattern.scope}, modelVersion:"deterministic_hypothesis_v1"
      }
    ];
    rows.sort((a,b)=>b.confidence-a.confidence).forEach((row,index)=>out.push({...row,id:hid(group,row.hypothesisType),rank:index+1}));
  }
  return out;
}
