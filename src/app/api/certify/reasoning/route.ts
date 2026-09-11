import { NextResponse } from "next/server";
import { derivePatterns } from "@/lib/patterns";
import { deriveHypotheses } from "@/lib/hypotheses";
import type { Signal } from "@/lib/types";

export async function GET(){
  const now=new Date().toISOString();
  const signal=(id:string,kind:Signal["kind"],sourceId:string,score:number):Signal=>({id,kind,sourceId,score,baseline:1,current:score+1,observedAt:now,evidenceObservationIds:[`obs-${id}`],details:{fixture:true}});
  const signals:Signal[]=[
    signal("cisa-change","change_point","cisa-news",6),
    signal("fed-z","z_score","fed-press",4),
    signal("nws-centrality","centrality_shift","nws-active-alerts",7),
    signal("github-co","co_occurrence","github-blog",5),
    signal("cross","cross_source_correlation","multi",8),
  ];
  const patterns=derivePatterns(signals);
  const hypotheses=deriveHypotheses(patterns);
  const groups=new Map<string,typeof hypotheses>();
  for(const h of hypotheses){const rows=groups.get(h.competitionGroup)??[];rows.push(h);groups.set(h.competitionGroup,rows);}
  const competing=[...groups.values()].every(rows=>rows.length>=2&&rows.some(h=>h.rank===1)&&rows.some(h=>h.rank===2));
  const pass=patterns.some(p=>p.patternType==="cross_domain_convergence")&&patterns.some(p=>p.patternType==="structural_shift_cluster")&&hypotheses.length>=4&&competing&&hypotheses.every(h=>h.expectedEvidence.length>0&&h.falsifiers.length>0);
  return NextResponse.json({certification:"reasoning_runtime",sideEffects:"none",llmProvider:"none",patterns:patterns.map(p=>p.patternType),hypothesisTypes:[...new Set(hypotheses.map(h=>h.hypothesisType))],competitionGroups:groups.size,competing,expectationsPresent:hypotheses.every(h=>h.expectedEvidence.length>0),falsifiersPresent:hypotheses.every(h=>h.falsifiers.length>0),pass});
}
