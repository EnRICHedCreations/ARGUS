import { createHash } from "node:crypto";
import type { Observation } from "./types";
import type { EntityCandidate } from "./entities";

export type TemporalRelationship = {
  id: string;
  subjectEntityId: string;
  objectEntityId?: string;
  objectEventId?: string;
  relationshipType: "co_occurs_with" | "mentioned_in";
  validFrom: string;
  observedAt: string;
  confidence: number;
  derivationMethod: "deterministic_cooccurrence_v1" | "deterministic_entity_event_v1";
  evidenceObservationIds: string[];
};

export function deriveRelationships(observation: Observation, entities: EntityCandidate[]): TemporalRelationship[] {
  const unique = [...new Map(entities.map(entity => [entity.id, entity])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const relationships: TemporalRelationship[] = [];

  for (const entity of unique) {
    const relationshipType = "mentioned_in" as const;
    const id = createHash("sha256")
      .update(`relationship\n${relationshipType}\n${entity.id}\n${observation.id}`)
      .digest("hex").slice(0, 32);
    relationships.push({
      id,
      subjectEntityId: entity.id,
      objectEventId: observation.id,
      relationshipType,
      validFrom: observation.publishedAt,
      observedAt: observation.observedAt,
      confidence: entity.confidence,
      derivationMethod: "deterministic_entity_event_v1",
      evidenceObservationIds: [observation.id],
    });
  }

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const subject = unique[i];
      const object = unique[j];
      const relationshipType = "co_occurs_with" as const;
      const id = createHash("sha256")
        .update(`relationship\n${relationshipType}\n${subject.id}\n${object.id}\n${observation.id}`)
        .digest("hex").slice(0, 32);
      relationships.push({
        id,
        subjectEntityId: subject.id,
        objectEntityId: object.id,
        relationshipType,
        validFrom: observation.publishedAt,
        observedAt: observation.observedAt,
        confidence: Math.min(subject.confidence, object.confidence),
        derivationMethod: "deterministic_cooccurrence_v1",
        evidenceObservationIds: [observation.id],
      });
    }
  }

  return relationships;
}
