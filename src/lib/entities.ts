import { createHash } from "node:crypto";
import type { Observation } from "./types";

export type EntityCandidate = {
  id: string;
  canonicalName: string;
  normalizedName: string;
  entityType: "organization" | "location" | "technology" | "unknown";
  mentionText: string;
  confidence: number;
};

const aliases: Record<string, { canonical: string; type: EntityCandidate["entityType"] }> = {
  nasa: { canonical: "NASA", type: "organization" },
  "national aeronautics and space administration": { canonical: "NASA", type: "organization" },
  usgs: { canonical: "USGS", type: "organization" },
  "u s geological survey": { canonical: "USGS", type: "organization" },
  "united states geological survey": { canonical: "USGS", type: "organization" },
  github: { canonical: "GitHub", type: "technology" },
  "github com": { canonical: "GitHub", type: "technology" },
};

const sourceEntities: Record<string, { canonical: string; type: EntityCandidate["entityType"] }> = {
  "nasa-breaking": { canonical: "NASA", type: "organization" },
  "usgs-all-hour": { canonical: "USGS", type: "organization" },
  "github-blog": { canonical: "GitHub", type: "technology" },
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function makeCandidate(canonicalName: string, entityType: EntityCandidate["entityType"], mentionText: string, confidence: number): EntityCandidate {
  const normalizedName = normalize(canonicalName);
  return {
    id: createHash("sha256").update(`entity\n${normalizedName}`).digest("hex").slice(0, 24),
    canonicalName,
    normalizedName,
    entityType,
    mentionText,
    confidence,
  };
}

export function extractEntities(observation: Observation): EntityCandidate[] {
  const found = new Map<string, EntityCandidate>();
  const text = normalize(`${observation.title} ${observation.summary}`);

  const sourceEntity = sourceEntities[observation.sourceId];
  if (sourceEntity) {
    const entity = makeCandidate(sourceEntity.canonical, sourceEntity.type, sourceEntity.canonical, 1);
    found.set(entity.id, entity);
  }

  for (const [alias, target] of Object.entries(aliases)) {
    const normalizedAlias = normalize(alias);
    if (!new RegExp(`(^| )${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(text)) continue;
    const entity = makeCandidate(target.canonical, target.type, alias, 1);
    found.set(entity.id, entity);
  }

  return [...found.values()];
}
