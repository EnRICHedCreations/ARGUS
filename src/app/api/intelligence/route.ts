import { NextResponse } from "next/server";
import { getPatterns,getHypotheses } from "@/lib/reasoning-memory";
import { getExpectations } from "@/lib/expectation-memory";
import { getEventLinks } from "@/lib/event-chain-memory";
import { buildIntelligenceBrief } from "@/lib/intelligence-brief";
export async function GET(){try{const[patterns,hypotheses,expectations,eventLinks]=await Promise.all([getPatterns(),getHypotheses(),getExpectations(),getEventLinks(500)]);return NextResponse.json({classification:"intelligence_brief",brief:buildIntelligenceBrief({patterns,hypotheses,expectations,eventLinks}),llmProvider:"none",modelVersion:"deterministic_intelligence_brief_v1"});}catch(error){return NextResponse.json({error:String(error)},{status:500});}}
