import { createHash } from "node:crypto";
import type { EventLink } from "./event-chains";
import type { ArgusEvent } from "./events";
import type { ArgusPattern } from "./patterns";

const norm=(v?:string)=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const bucket=(iso:string)=>iso.slice(0,13);
function pid(type:ArgusPattern["patternType"],scope:string,at:string,ids:string[]){return createHash("sha256").update(`temporal-pattern\n${type}\n${scope}\n${bucket(at)}\n${ids.sort().join("|")}`).digest("hex").slice(0,32);}

export function deriveTemporalPatterns(events:ArgusEvent[],links:EventLink[]):ArgusPattern[]{
 const eventById=new Map(events.map(e=>[e.id,e]));
 const out:ArgusPattern[]=[];
 const sequenceLinks=links.filter(l=>l.linkType==="precedes"&&l.confidence>=.78);
 const recurrenceLinks=links.filter(l=>l.linkType==="recurs_with"&&l.confidence>=.82);

 // Multi-step sequences: at least two strong precedence edges touching a connected event set.
 const adjacency=new Map<string,EventLink[]>();for(const l of sequenceLinks){for(const id of [l.subjectEventId,l.objectEventId]){const rows=adjacency.get(id)??[];rows.push(l);adjacency.set(id,rows);}}
 const seen=new Set<string>();
 for(const start of adjacency.keys()){
  if(seen.has(start))continue;const stack=[start],eventIds=new Set<string>(),edgeIds=new Set<string>();
  while(stack.length){const id=stack.pop()!;if(seen.has(id))continue;seen.add(id);eventIds.add(id);for(const edge of adjacency.get(id)??[]){edgeIds.add(edge.id);const other=edge.subjectEventId===id?edge.objectEventId:edge.subjectEventId;if(!seen.has(other))stack.push(other);}}
  if(edgeIds.size<2||eventIds.size<3)continue;
  const ev=[...eventIds].map(id=>eventById.get(id)).filter((x):x is ArgusEvent=>Boolean(x)).sort((a,b)=>Date.parse(a.effectiveAt??a.firstObservedAt)-Date.parse(b.effectiveAt??b.firstObservedAt));if(ev.length<3)continue;
  const areas=[...new Set(ev.map(e=>norm(e.area)).filter(Boolean))];const types=[...new Set(ev.map(e=>e.eventType))];const at=ev.at(-1)?.lastObservedAt??new Date().toISOString();const scope=areas.length===1?areas[0]:types.slice(0,4).join(" -> ");const confidence=sequenceLinks.filter(l=>edgeIds.has(l.id)).reduce((s,l)=>s+l.confidence,0)/edgeIds.size;
  out.push({id:pid("temporal_sequence_cluster",scope,at,[...edgeIds]),patternType:"temporal_sequence_cluster",detectedAt:at,scope,score:Number((confidence*edgeIds.size).toFixed(4)),statement:`A ${ev.length}-event sequence has formed${areas.length===1?` in ${ev[0].area}`:""}: ${types.slice(0,5).join(" → ")}. This is ordered temporal structure, not simple co-occurrence.`,evidenceSignalIds:[],evidenceObservationIds:[...new Set(ev.flatMap(e=>e.evidenceObservationIds))],details:{eventIds:[...eventIds],eventLinkIds:[...edgeIds],eventTypes:types,areas,edgeCount:edgeIds.size,meanConfidence:confidence},modelVersion:"deterministic_temporal_pattern_v1"});
 }

 // Recurrence clusters: repeated same-type/same-region events supported by at least two recurrence edges.
 const recurGroups=new Map<string,EventLink[]>();
 for(const l of recurrenceLinks){const a=eventById.get(l.subjectEventId),b=eventById.get(l.objectEventId);if(!a||!b)continue;const k=`${norm(a.eventType)}|${norm(a.area)}`;const rows=recurGroups.get(k)??[];rows.push(l);recurGroups.set(k,rows);}
 for(const rows of recurGroups.values()){
  if(rows.length<2)continue;const ids=[...new Set(rows.flatMap(r=>[r.subjectEventId,r.objectEventId]))];const ev=ids.map(id=>eventById.get(id)).filter((x):x is ArgusEvent=>Boolean(x));if(ev.length<3)continue;const at=ev.map(e=>e.lastObservedAt).sort().at(-1)!;const scope=`${ev[0].eventType}:${ev[0].area??"unknown-area"}`;const mean=rows.reduce((s,r)=>s+r.confidence,0)/rows.length;
  out.push({id:pid("regional_recurrence_cluster",scope,at,rows.map(r=>r.id)),patternType:"regional_recurrence_cluster",detectedAt:at,scope,score:Number((mean*rows.length).toFixed(4)),statement:`${ev[0].eventType} has recurred ${ev.length} times in the same regional scope within the modeled event history.`,evidenceSignalIds:[],evidenceObservationIds:[...new Set(ev.flatMap(e=>e.evidenceObservationIds))],details:{eventIds:ids,eventLinkIds:rows.map(r=>r.id),eventType:ev[0].eventType,area:ev[0].area,meanConfidence:mean},modelVersion:"deterministic_temporal_pattern_v1"});
 }
 return out.sort((a,b)=>b.score-a.score).slice(0,25);
}
