import type { Observation } from "./types";
import type { EntityCandidate } from "./entities";
import type { TemporalRelationship } from "./relationships";

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
      if (response.ok) return body.trim() ? JSON.parse(body) : null;
      lastError = `ARGUS graph memory request failed (${response.status}): ${body.slice(0, 500)}`;
      if (![502, 503, 504].includes(response.status) || attempt === 2) throw new Error(lastError);
    } catch (error) {
      lastError = String(error);
      if (attempt === 2) throw error;
    }
    await sleep(150 * 2 ** attempt);
  }
  throw new Error(lastError || "ARGUS graph memory request failed");
}

async function postChunks(path: string, rows: Record<string, unknown>[], prefer: string, size = 250) {
  for (let i = 0; i < rows.length; i += size) {
    await request(path, {
      method: "POST",
      headers: { Prefer: prefer },
      body: JSON.stringify(rows.slice(i, i + size)),
    });
  }
}

export async function rememberEntityGraphV2(entries: Array<{ observation: Observation; entities: EntityCandidate[]; relationships: TemporalRelationship[] }>) {
  const entityRows = new Map<string, Record<string, unknown>>();
  const aliasRows = new Map<string, Record<string, unknown>>();
  const observationEntityRows = new Map<string, Record<string, unknown>>();
  const relationshipRows = new Map<string, Record<string, unknown>>();
  const relationshipEvidenceRows = new Map<string, Record<string, unknown>>();

  for (const { observation, entities, relationships } of entries) {
    for (const entity of entities) {
      entityRows.set(entity.id, {
        id: entity.id,
        canonical_name: entity.canonicalName,
        entity_type: entity.entityType,
        normalized_name: entity.normalizedName,
        first_seen_at: observation.observedAt,
        last_seen_at: observation.observedAt,
      });
      const normalizedAlias = entity.mentionText.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      aliasRows.set(normalizedAlias, {
        entity_id: entity.id,
        alias: entity.mentionText,
        normalized_alias: normalizedAlias,
      });
      observationEntityRows.set(`${observation.id}:${entity.id}:${entity.mentionText}`, {
        observation_id: observation.id,
        entity_id: entity.id,
        mention_text: entity.mentionText,
        extraction_method: "deterministic_v3",
        confidence: entity.confidence,
      });
    }

    for (const relationship of relationships) {
      relationshipRows.set(relationship.id, {
        id: relationship.id,
        subject_entity_id: relationship.subjectEntityId,
        object_entity_id: relationship.objectEntityId ?? null,
        object_event_id: relationship.objectEventId ?? null,
        relationship_type: relationship.relationshipType,
        valid_from: relationship.validFrom,
        observed_at: relationship.observedAt,
        confidence: relationship.confidence,
        derivation_method: relationship.derivationMethod,
        evidence_observation_ids: relationship.evidenceObservationIds,
      });
      for (const observationId of relationship.evidenceObservationIds) {
        relationshipEvidenceRows.set(`${relationship.id}:${observationId}`, {
          relationship_id: relationship.id,
          observation_id: observationId,
          observed_at: relationship.observedAt,
        });
      }
    }
  }

  // Dependency order matters: entities -> observation links -> relationships -> evidence.
  // Aliases are deliberately last so an alias collision can never prevent the graph itself persisting.
  await postChunks("argus_entities?on_conflict=id", [...entityRows.values()], "resolution=merge-duplicates,return=minimal");
  await postChunks("argus_observation_entities?on_conflict=observation_id,entity_id,mention_text", [...observationEntityRows.values()], "resolution=ignore-duplicates,return=minimal");
  await postChunks("argus_relationships?on_conflict=id", [...relationshipRows.values()], "resolution=ignore-duplicates,return=minimal", 150);
  await postChunks("argus_relationship_evidence?on_conflict=relationship_id,observation_id", [...relationshipEvidenceRows.values()], "resolution=ignore-duplicates,return=minimal", 250);

  // normalized_alias is globally unique in the schema. Conflict on that actual invariant,
  // not the composite primary key, so ambiguous/repeated aliases are ignored safely.
  await postChunks("argus_entity_aliases?on_conflict=normalized_alias", [...aliasRows.values()], "resolution=ignore-duplicates,return=minimal");
}
