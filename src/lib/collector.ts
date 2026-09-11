import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { Observation, Source } from "./types";

const parser = new Parser();
function observationId(sourceId:string,externalId:string,title:string){const fingerprint=createHash("sha256").update(`${sourceId}\n${externalId}\n${title}`).digest("hex");return{fingerprint,id:fingerprint.slice(0,24)}}
function iso(value:unknown){if(!value)return undefined;const d=new Date(String(value));return Number.isNaN(d.getTime())?undefined:d.toISOString();}

async function collectNwsAlerts(source:Source):Promise<Observation[]>{
 const observedAt=new Date().toISOString();
 const response=await fetch(source.url,{headers:{Accept:"application/geo+json","User-Agent":"ARGUS intelligence observer (https://argus.apps.deployhatch.com)"},cache:"no-store"});
 if(!response.ok)throw new Error(`NWS API ${response.status}`);
 const payload=await response.json() as {features?:Array<{id?:string;properties?:Record<string,unknown>}>};
 return (payload.features||[]).map((feature,index)=>{const p=feature.properties||{};const title=String(p.headline||p.event||"NWS active alert").trim();const externalId=String(feature.id||p.id||`${p.sent||observedAt}:${index}`);const publishedAt=iso(p.sent)||iso(p.effective)||observedAt;const url=String(p["@id"]||feature.id||source.url);const structured=[p.event&&`event=${p.event}`,p.severity&&`severity=${p.severity}`,p.urgency&&`urgency=${p.urgency}`,p.certainty&&`certainty=${p.certainty}`,iso(p.effective)&&`effective=${iso(p.effective)}`,iso(p.onset)&&`onset=${iso(p.onset)}`,iso(p.expires)&&`expires=${iso(p.expires)}`,iso(p.ends)&&`ends=${iso(p.ends)}`,p.areaDesc&&`area=${p.areaDesc}`,p.senderName&&`sender=${p.senderName}`,p.description&&`description=${String(p.description).replace(/\s+/g," ")}`].filter(Boolean).join(" | ").slice(0,1000);const {fingerprint,id}=observationId(source.id,externalId,title);return{id,sourceId:source.id,externalId,title,url,publishedAt,observedAt,summary:structured,fingerprint};});
}

async function collectHackerNews(source:Source):Promise<Observation[]>{
 const observedAt=new Date().toISOString();const idsResponse=await fetch(source.url,{cache:"no-store"});if(!idsResponse.ok)throw new Error(`HN API ${idsResponse.status}`);const ids=(await idsResponse.json() as number[]).slice(0,30);
 const rows=await Promise.all(ids.map(async id=>{try{const r=await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`,{cache:"no-store"});if(!r.ok)return null;const item=await r.json() as {id:number;title?:string;url?:string;time?:number;score?:number;by?:string;descendants?:number};if(!item.title)return null;const title=item.title.trim();const externalId=String(item.id);const publishedAt=item.time?new Date(item.time*1000).toISOString():observedAt;const url=item.url||`https://news.ycombinator.com/item?id=${item.id}`;const summary=`score=${item.score??0} | comments=${item.descendants??0} | author=${item.by??"unknown"}`;const {fingerprint,id:oid}=observationId(source.id,externalId,title);return{id:oid,sourceId:source.id,externalId,title,url,publishedAt,observedAt,summary,fingerprint};}catch{return null;}}));return rows.filter((x):x is Observation=>x!==null);
}

export async function collect(source:Source):Promise<Observation[]>{if(!source.enabled)return[];if(source.kind==="nws_alerts_json")return collectNwsAlerts(source);if(source.kind==="hackernews_json")return collectHackerNews(source);const feed=await parser.parseURL(source.url);const observedAt=new Date().toISOString();return feed.items.slice(0,100).map((item,index)=>{const title=item.title?.trim()||"Untitled observation";const url=item.link||source.url;const publishedAt=new Date(item.isoDate||item.pubDate||observedAt).toISOString();const externalId=item.guid||item.id||url||`${publishedAt}:${index}`;const summary=String(item.contentSnippet||item.content||"").replace(/\s+/g," ").trim().slice(0,1000);const{fingerprint,id}=observationId(source.id,externalId,title);return{id,sourceId:source.id,externalId,title,url,publishedAt,observedAt,summary,fingerprint};});}
