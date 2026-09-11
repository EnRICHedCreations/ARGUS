import { NextResponse } from "next/server";
import { generatePredictions } from "@/lib/oracle";
import type { Signal } from "@/lib/types";
const now=new Date("2026-01-01T12:00:00Z");
const mk=(id:string,sourceId:string,kind:Signal["kind"],score:number):Signal=>({id,sourceId,kind,score,baseline:1,current:4,observedAt:"2026-01-01T11:30:00Z",evidenceObservationIds:[`o-${id}`]});
export async function GET(){const boring=[mk("a","usgs-all-hour","volume_spike",4),mk("b","usgs-all-hour","z_score",3)];const rich=[mk("1","cisa-news","volume_spike",4),mk("2","cisa-news","z_score",3),mk("3","sec-press","acceleration",5),mk("4","sec-press","change_point",3),mk("5","hackernews-top","novelty",4),mk("6","hackernews-top","z_score",2)];const silent=generatePredictions(boring,now);const predictions=generatePredictions(rich,now);const pass=silent.length===0&&predictions.length===1&&predictions[0].predictionType==="cross_domain_follow_through"&&predictions[0].horizonHours===12;return NextResponse.json({pass,boringSingleDomainSuppressed:silent.length===0,crossDomainPrediction:predictions[0]??null,modelVersion:"deterministic_oracle_v2"},{status:pass?200:500});}
