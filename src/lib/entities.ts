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
  "u.s. geological survey": { canonical: "USGS", type: "organization" },
  "united states geological survey": { canonical: "USGS", type: "organization" },
  github: { canonical: "GitHub", type: "technology" },
  "github.com": { canonical: "GitHub", type: "technology" },
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function candidate(canonicalName: string, entityType: EntityCandidate["entityType"], mentionText: string, confidence: number): EntityCandidate {
  const normalizedName = normalize(canonicalName);
  return { id: createHash("sha256").update(`entity\n${normalizedName}`).digest("hex").slice(0, 24), canonicalName, normalizedName, entityType, mentionText, confidence };
}

export function extractEntities(observation: Observation): EntityCandidate[] {
  const text = `${observation.title} ${observation.summary}`;
  const normalizedText = normalize(text);
  const found = new Map<string, EntityCandidate>();

  for (const [alias, target] of Object.entries(aliases)) {
    const normalizedAlias = normalize(alias);
    if (new RegExp(`(^| )${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(normalizedText)) {
      const entity = candidate(target.canonical, target.type, alias, 1);
      found.set(entity.id, entity);
    }
  }

  // Deterministic proper-name extraction. Conservative by design: two-or-more title-cased words only.
  const properNames = text.match(/\b(?:[A-Z][a-z]{2,}(?:\s+|[-–—]))+[A-Z][A-Za-z]{2,}\b/g) ?? [];
  for (const mention of properNames) {
    const clean = mention.replace(/\s+/g, " ").trim();
    const norm = normalize(clean);
    if (norm.length < 5 || Object.keys(aliases).some(a => normalize(a) === norm)) continue;
    const entity = candidate(clean, "unknown", clean, 0.7);
    if (!found.has(entity.id)) found.set(entity.id, entity);
  }

  return [...found.values()];
}
