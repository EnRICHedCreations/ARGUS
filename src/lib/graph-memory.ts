import type { Observation } from "./types";
import type { EntityCandidate } from "./entities";
import type { TemporalRelationship } from "./relationships";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ARGUS persistent memory requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function request(path:string,init?:RequestInit){const{url,key}=config();let last="";for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(`${url}/rest/v1/${path}`,{...init,cache:"no-store",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...init?.headers}});const body=await response.text();if(response.ok)return body.trim()?JSON.parse(body):null;last=`ARGUS graph memory request failed (${response.status}): ${body.slice(0,500)}`;if(![502,503,504].includes(response.status)||attempt===2)throw new Error(last)}catch(e){last=String(e);if(attempt===2)throw e}await sleep(150*2**attempt)}throw new Error(last)}
async function postChunks(path:string,rows:Record<string,unknown>[],prefer:string,size=250){for(let i=0;i<rows.length;i+=size)await request(path,{method:"POST",headers:{Prefer:prefer},body:JSON.stringify(rows.slice(i,i+size))})}

// Entity identity v4 treats normalized_name as the durable database identity.  This
// prevents a changed hash/canonical spelling from colliding with an older row and
// taking down an entire observation batch.
async function resolveEntities(rows:Record<string,unknown>[]){if(!rows.length)return new Map<string,string>();const names=[...new Set(rows.map(r=>String(r.normalized_name)))];const found=new Map<string,string>();for(let i=0;i<names.length;i+=100){const q=names.slice(i,i+100).map(encodeURIComponent).join(",");const existing=await request(`argus_entities?select=id,normalized_name&normalized_name=in.(${q})`);for(const r of existing??[])found.set(String(r.normalized_name),String(r.id))}const missing=rows.filter(r=>!found.has(String(r.normalized_name)));if(missing.length){await postChunks("argus_entities?on_conflict=normalized_name",missing,"resolution=ignore-duplicates,return=minimal",100);for(let i=0;i<names.length;i+=100){const q=names.slice(i,i+100).map(encodeURIComponent).join(",");const existing=await request(`argus_entities?select=id,normalized_name&normalized_name=in.(${q})`);for(const r of existing??[])found.set(String(r.normalized_name),String(r.id))}}return found}

export async function rememberEntityGraphV2(entries:Array<{observation:Observation;entities:EntityCandidate[];relationships:TemporalRelationship[]}>){
 const rawEntities=new Map<string,Record<string,unknown>>();for(const{observation,entities}of entries)for(const e of entities)rawEntities.set(e.normalizedName,{id:e.id,canonical_name:e.canonicalName,entity_type:e.entityType,normalized_name:e.normalizedName,first_seen_at:observation.observedAt,last_seen_at:observation.observedAt});
 const resolved=await resolveEntities([...rawEntities.values()]);
 const idMap=new Map<string,string>();for(const{entities}of entries)for(const e of entities){const id=resolved.get(e.normalizedName);if(id)idMap.set(e.id,id)}
 const aliases=new Map<string,Record<string,unknown>>(),links=new Map<string,Record<string,unknown>>(),rels=new Map<string,Record<string,unknown>>(),evidence=new Map<string,Record<string,unknown>>();
 for(const{observation,entities,relationships}of entries){for(const e of entities){const id=idMap.get(e.id);if(!id)continue;const na=e.mentionText.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();aliases.set(na,{entity_id:id,alias:e.mentionText,normalized_alias:na});links.set(`${observation.id}:${id}:${e.mentionText}`,{observation_id:observation.id,entity_id:id,mention_text:e.mentionText,extraction_method:"deterministic_v4",confidence:e.confidence})}for(const r of relationships){const sid=idMap.get(r.subjectEntityId),oid=r.objectEntityId?idMap.get(r.objectEntityId):undefined;if(!sid)continue;const row={id:r.id,subject_entity_id:sid,object_entity_id:oid??null,object_event_id:r.objectEventId??null,relationship_type:r.relationshipType,valid_from:r.validFrom,observed_at:r.observedAt,confidence:r.confidence,derivation_method:r.derivationMethod,evidence_observation_ids:r.evidenceObservationIds};rels.set(r.id,row);for(const observationId of r.evidenceObservationIds)evidence.set(`${r.id}:${observationId}`,{relationship_id:r.id,observation_id:observationId,observed_at:r.observedAt})}}
 await postChunks("argus_observation_entities?on_conflict=observation_id,entity_id,mention_text",[...links.values()],"resolution=ignore-duplicates,return=minimal");
 // Relationship IDs encode prior entity IDs. A collision here is derived-state noise,
 // so isolate failures to a single row instead of aborting the observation cycle.
 for(const row of rels.values())try{await postChunks("argus_relationships?on_conflict=id",[row],"resolution=ignore-duplicates,return=minimal",1)}catch{}
 for(const row of evidence.values())try{await postChunks("argus_relationship_evidence?on_conflict=relationship_id,observation_id",[row],"resolution=ignore-duplicates,return=minimal",1)}catch{}
 await postChunks("argus_entity_aliases?on_conflict=normalized_alias",[...aliases.values()],"resolution=ignore-duplicates,return=minimal");
 return idMap;
}
