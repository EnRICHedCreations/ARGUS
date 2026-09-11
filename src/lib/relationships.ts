import { createHash } from "node:crypto";
import type { Observation } from "./types";
import type { EntityCandidate } from "./entities";
import type { ArgusEvent } from "./events";

export type TemporalRelationship = {
  id: string;
  subjectEntityId: string;
  objectEntityId?: string;
  objectEventId?: string;
  relationshipType: "co_occurs_with" | "participates_in";
  validFrom: string;
  observedAt: string;
  confidence: number;
  derivationMethod: "deterministic_cooccurrence_v2" | "deterministic_entity_event_v2";
  evidenceObservationIds: string[];
};

export function deriveRelationships(observation: Observation, entities: EntityCandidate[], events: ArgusEvent[] = []): TemporalRelationship[] {
  const unique = [...new Map(entities.map(entity => [entity.id, entity])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const relationships: TemporalRelationship[] = [];

  // A relationship to an event is only emitted when a first-class event instance exists.
  for (const event of events) {
    for (const entity of unique) {
      const relationshipType = "participates_in" as const;
      const id = createHash("sha256").update(`relationship\n${relationshipType}\n${entity.id}\n${event.id}`).digest("hex").slice(0, 32);
      relationships.push({ id, subjectEntityId: entity.id, objectEventId: event.id, relationshipType, validFrom: event.effectiveAt ?? observation.publishedAt, observedAt: observation.observedAt, confidence: entity.confidence, derivationMethod: "deterministic_entity_event_v2", evidenceObservationIds: [observation.id] });
    }
  }

  // Bound co-occurrence: location-location pairs add little semantic value and explode quadratically.
  const pairs = new Set<string>();
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const subject = unique[i]; const object = unique[j];
      if (subject.entityType === "location" && object.entityType === "location") continue;
      const pairKey = `${subject.id}:${object.id}`;
      if (pairs.has(pairKey)) continue;
      pairs.add(pairKey);
      const relationshipType = "co_occurs_with" as const;
      const id = createHash("sha256").update(`relationship\n${relationshipType}\n${subject.id}\n${object.id}\n${observation.id}`).digest("hex").slice(0, 32);
      relationships.push({ id, subjectEntityId: subject.id, objectEntityId: object.id, relationshipType, validFrom: observation.publishedAt, observedAt: observation.observedAt, confidence: Math.min(subject.confidence, object.confidence), derivationMethod: "deterministic_cooccurrence_v2", evidenceObservationIds: [observation.id] });
    }
  }
  return relationships;
}
