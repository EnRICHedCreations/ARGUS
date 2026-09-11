import type { Observation, Signal } from "./types";
import type { EntityCandidate } from "./entities";
import type { TemporalRelationship } from "./relationships";
import type { AnalystEvidence } from "./analyst";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ARGUS persistent memory requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function request(path: string, init?: RequestInit) {
  const { url, key } = config();
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        cache: "no-store",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers },
      });
      const body = await response.text();
      if (response.ok) {
        if (!body.trim()) return null;
        try { return JSON.parse(body); }
        catch { throw new Error(`ARGUS memory returned invalid JSON (${response.status}): ${body.slice(0, 500)}`); }
      }
      lastError = `ARGUS memory request failed (${response.status}): ${body.slice(0, 500)}`;
      if (![502, 503, 504].includes(response.status) || attempt === 2) throw new Error(lastError);
    } catch (error) {
      lastError = String(error);
      if (attempt === 2) throw error;
    }
    await sleep(150 * 2 ** attempt);
  }
  throw new Error(lastError || "ARGUS memory request failed");
}

export async function remember(items: Observation[]) {
  if (!items.length) return;
  await request("argus_observations?on_conflict=fingerprint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(items.map(item => ({ fingerprint: item.fingerprint, id: item.id, source_id: item.sourceId, external_id: item.externalId, title: item.title, url: item.url, published_at: item.publishedAt, observed_at: item.observedAt, summary: item.summary }))) });
}

export async function rememberSignals(signals: Signal[]) {
  if (!signals.length) return;
  await request("argus_signals?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(signals.map(signal => ({ id: signal.id, kind: signal.kind, source_id: signal.sourceId, observed_at: signal.observedAt, score: signal.score, baseline: signal.baseline, current_value: signal.current, evidence_observation_ids: signal.evidenceObservationIds, details: signal.details ?? {} }))) });
}

export async function rememberEntityGraph(entries: Array<{ observation: Observation; entities: EntityCandidate[]; relationships: TemporalRelationship[] }>) {
  const entityRows = new Map<string, Record<string, unknown>>();
  const aliasRows = new Map<string, Record<string, unknown>>();
  const observationEntityRows = new Map<string, Record<string, unknown>>();
  const relationshipRows = new Map<string, Record<string, unknown>>();
  const relationshipEvidenceRows = new Map<string, Record<string, unknown>>();

  for (const { observation, entities, relationships } of entries) {
    for (const entity of entities) {
      entityRows.set(entity.id, { id: entity.id, canonical_name: entity.canonicalName, entity_type: entity.entityType, normalized_name: entity.normalizedName, first_seen_at: observation.observedAt, last_seen_at: observation.observedAt });
      const normalizedAlias = entity.mentionText.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      aliasRows.set(`${entity.id}:${normalizedAlias}`, { entity_id: entity.id, alias: entity.mentionText, normalized_alias: normalizedAlias });
      observationEntityRows.set(`${observation.id}:${entity.id}:${entity.mentionText}`, { observation_id: observation.id, entity_id: entity.id, mention_text: entity.mentionText, extraction_method: "deterministic_v2", confidence: entity.confidence });
    }
    for (const relationship of relationships) {
      relationshipRows.set(relationship.id, { id: relationship.id, subject_entity_id: relationship.subjectEntityId, object_entity_id: relationship.objectEntityId ?? null, object_event_id: relationship.objectEventId ?? null, relationship_type: relationship.relationshipType, valid_from: relationship.validFrom, observed_at: relationship.observedAt, confidence: relationship.confidence, derivation_method: relationship.derivationMethod, evidence_observation_ids: relationship.evidenceObservationIds });
      for (const observationId of relationship.evidenceObservationIds) relationshipEvidenceRows.set(`${relationship.id}:${observationId}`, { relationship_id: relationship.id, observation_id: observationId, observed_at: relationship.observedAt });
    }
  }

  if (entityRows.size) await request("argus_entities?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([...entityRows.values()]) });
  if (aliasRows.size) await request("argus_entity_aliases?on_conflict=entity_id,normalized_alias", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify([...aliasRows.values()]) });
  if (observationEntityRows.size) await request("argus_observation_entities?on_conflict=observation_id,entity_id,mention_text", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify([...observationEntityRows.values()]) });
  if (relationshipRows.size) await request("argus_relationships?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify([...relationshipRows.values()]) });
  if (relationshipEvidenceRows.size) await request("argus_relationship_evidence?on_conflict=relationship_id,observation_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify([...relationshipEvidenceRows.values()]) });
}

export async function getAnalystEvidence(): Promise<AnalystEvidence> {
  const entityRows = (await request("argus_observation_entities?select=observation_id,entity_id&limit=5000") ?? []) as Array<Record<string, unknown>>;
  const relationshipRows = (await request("argus_relationships?select=id,subject_entity_id,object_entity_id,object_event_id,relationship_type,valid_from,evidence_observation_ids&order=valid_from.desc&limit=5000") ?? []) as Array<Record<string, unknown>>;
  return {
    entityLinks: entityRows.map(row => ({ observationId: String(row.observation_id), entityId: String(row.entity_id) })),
    relationships: relationshipRows.map(row => ({ id: String(row.id), subjectEntityId: String(row.subject_entity_id), objectEntityId: row.object_entity_id == null ? undefined : String(row.object_entity_id), objectEventId: row.object_event_id == null ? undefined : String(row.object_event_id), relationshipType: String(row.relationship_type), validFrom: String(row.valid_from), evidenceObservationIds: Array.isArray(row.evidence_observation_ids) ? row.evidence_observation_ids.map(String) : [] })),
  };
}

export async function getGraphStats() {
  const relationships = (await request("argus_relationships?select=id,relationship_type,object_entity_id,object_event_id") ?? []) as Array<Record<string, unknown>>;
  const evidence = (await request("argus_relationship_evidence?select=relationship_id,observation_id") ?? []) as unknown[];
  return { relationships: relationships.length, relationshipEvidence: evidence.length, entityEventRelationships: relationships.filter(r => r.object_event_id != null).length, entityEntityRelationships: relationships.filter(r => r.object_entity_id != null).length };
}

export async function getEntityStats() {
  const entities = (await request("argus_entities?select=id") ?? []) as unknown[];
  const links = (await request("argus_observation_entities?select=observation_id,entity_id") ?? []) as unknown[];
  return { entities: entities.length, entityLinks: links.length };
}

export async function getObservations(): Promise<Observation[]> {
  const rows = (await request("argus_observations?select=id,source_id,external_id,title,url,published_at,observed_at,summary,fingerprint&order=published_at.desc&limit=5000") ?? []) as Array<Record<string, unknown>>;
  return rows.map(row => ({ id: String(row.id), sourceId: String(row.source_id), externalId: String(row.external_id), title: String(row.title), url: String(row.url), publishedAt: String(row.published_at), observedAt: String(row.observed_at), summary: String(row.summary ?? ""), fingerprint: String(row.fingerprint) }));
}

export async function getSignals(): Promise<Signal[]> {
  const rows = (await request("argus_signals?select=id,kind,source_id,observed_at,score,baseline,current_value,evidence_observation_ids,details&order=observed_at.desc&limit=1000") ?? []) as Array<Record<string, unknown>>;
  return rows.map(row => ({ id: String(row.id), kind: String(row.kind) as Signal["kind"], sourceId: String(row.source_id), observedAt: String(row.observed_at), score: Number(row.score), baseline: Number(row.baseline), current: Number(row.current_value), evidenceObservationIds: Array.isArray(row.evidence_observation_ids) ? row.evidence_observation_ids.map(String) : [], details: row.details && typeof row.details === "object" ? row.details as Record<string, unknown> : {} }));
}
