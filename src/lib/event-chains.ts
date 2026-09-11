import { createHash } from "node:crypto";
import type { ArgusEvent } from "./events";

export type EventLink={id:string;subjectEventId:string;objectEventId:string;linkType:"precedes"|"overlaps"|"recurs_with";validFrom:string;observedAt:string;confidence:number;basis:Record<string,unknown>;modelVersion:"deterministic_event_chain_v2"};
const ms=(v?:string)=>v?new Date(v).getTime():NaN;
const norm=(v?:string)=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const areaTokens=(v?:string)=>new Set(String(v??"").split(/;|,/).map(norm).filter(x=>x.length>=3));
function jaccard(a:Set<string>,b:Set<string>){if(!a.size||!b.size)return 0;let shared=0;for(const x of a)if(b.has(x))shared++;return shared/(a.size+b.size-shared);}
function make(a:ArgusEvent,b:ArgusEvent,type:EventLink["linkType"],confidence:number,basis:Record<string,unknown>):EventLink{const id=createHash("sha256").update(`event-link-v2\n${type}\n${a.id}\n${b.id}`).digest("hex").slice(0,32);return{id,subjectEventId:a.id,objectEventId:b.id,linkType:type,validFrom:b.effectiveAt??b.firstObservedAt,observedAt:b.lastObservedAt,confidence:Number(confidence.toFixed(4)),basis,modelVersion:"deterministic_event_chain_v2"};}

export function deriveEventLinks(events:ArgusEvent[]):EventLink[]{
 const sorted=[...events].filter(e=>Number.isFinite(ms(e.effectiveAt))).sort((a,b)=>ms(a.effectiveAt)-ms(b.effectiveAt));
 const candidates:EventLink[]=[];
 for(let i=0;i<sorted.length;i++){
  const a=sorted[i],aAreas=areaTokens(a.area),aStart=ms(a.effectiveAt),aEnd=ms(a.expiresAt);
  for(let j=i+1;j<sorted.length&&j<i+40;j++){
   const b=sorted[j],bStart=ms(b.effectiveAt),gap=bStart-aStart;if(gap>8*3600_000)break;
   const overlap=jaccard(aAreas,areaTokens(b.area));if(overlap<0.34)continue;
   const sameType=norm(a.eventType)===norm(b.eventType),sameIssuer=norm(a.issuer)===norm(b.issuer)&&!!norm(a.issuer);
   const temporalOverlap=Number.isFinite(aEnd)&&bStart<=aEnd;
   if(temporalOverlap&&(sameType||sameIssuer)&&overlap>=0.5){const c=.7+.14*overlap+(sameType?.1:0)+(sameIssuer?.04:0);candidates.push(make(a,b,"overlaps",Math.min(.98,c),{areaOverlap:overlap,sameType,sameIssuer,gapMs:gap}));continue;}
   const afterEnd=Number.isFinite(aEnd)?bStart-aEnd:gap;
   if(sameType&&overlap>=0.5&&afterEnd>=10*60_000&&afterEnd<=6*3600_000){candidates.push(make(a,b,"recurs_with",Math.min(.96,.72+.16*overlap+.08),{areaOverlap:overlap,sameType:true,gapMs:afterEnd}));continue;}
   if(overlap>=0.5&&afterEnd>=0&&afterEnd<=3*3600_000&&(!sameType||gap>=20*60_000)){candidates.push(make(a,b,"precedes",Math.min(.93,.65+.18*overlap+(sameIssuer?.05:0)),{areaOverlap:overlap,sameType,sameIssuer,gapMs:afterEnd}));}
  }
 }
 // Keep only the strongest few outgoing links per event/type so dense weather bulletins cannot dominate the world model.
 const grouped=new Map<string,EventLink[]>();for(const link of candidates){const k=`${link.subjectEventId}:${link.linkType}`;const rows=grouped.get(k)??[];rows.push(link);grouped.set(k,rows);}
 const kept:EventLink[]=[];for(const rows of grouped.values())kept.push(...rows.sort((a,b)=>b.confidence-a.confidence).slice(0,3));
 return kept.sort((a,b)=>b.confidence-a.confidence);
}
