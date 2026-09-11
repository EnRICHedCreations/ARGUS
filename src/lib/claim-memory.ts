import type { ArgusClaim } from "./claims";

function config(){const base=process.env.SUPABASE_URL?.replace(/\/$/,"");const token=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!token)throw new Error("Supabase not configured");return{base,token};}

async function request(path:string,init:RequestInit={}){const{base,token}=config();const response=await fetch(`${base}${path}`,{...init,cache:"no-store",headers:{apikey:token,Authorization:`Bearer ${token}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal",...(init.headers||{})}});if(!response.ok)throw new Error(`claim memory request failed ${response.status}`);return response;}

export async function rememberClaims(rows:ArgusClaim[]){if(!rows.length)return;await request("/rest/v1/argus_claims?on_conflict=id",{method:"POST",body:JSON.stringify(rows.map(c=>({id:c.id,observation_id:c.observationId,source_id:c.sourceId,subject_entity_id:c.subjectEntityId,subject_name:c.subjectName,action:c.action,object_text:c.objectText,claim_class:c.claimClass,occurred_at:c.occurredAt,confidence:c.confidence,domain:c.domain,statement:c.statement,model_version:c.modelVersion})))});}

export async function getClaims(limit=500):Promise<ArgusClaim[]>{const response=await request(`/rest/v1/argus_claims?select=*&order=occurred_at.desc&limit=${limit}`,{headers:{Prefer:""}});const rows=await response.json() as any[];return rows.map(x=>({id:x.id,observationId:x.observation_id,sourceId:x.source_id,subjectEntityId:x.subject_entity_id,subjectName:x.subject_name,action:x.action,objectText:x.object_text,claimClass:x.claim_class,occurredAt:x.occurred_at,confidence:x.confidence,domain:x.domain,statement:x.statement,modelVersion:x.model_version}));}
