import { createHash } from "node:crypto";
import type { Observation } from "./types";

export type EntityCandidate = {
  id: string;
  canonicalName: string;
  normalizedName: string;
  entityType: "organization" | "location" | "technology" | "event_type" | "unknown";
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
  cisa: { canonical: "CISA", type: "organization" },
  "cybersecurity and infrastructure security agency": { canonical: "CISA", type: "organization" },
  "federal reserve": { canonical: "Federal Reserve", type: "organization" },
  fed: { canonical: "Federal Reserve", type: "organization" },
  "national hurricane center": { canonical: "National Hurricane Center", type: "organization" },
  nhc: { canonical: "National Hurricane Center", type: "organization" },
  "national weather service": { canonical: "National Weather Service", type: "organization" },
  nws: { canonical: "National Weather Service", type: "organization" },
};

const sourceEntities: Record<string, { canonical: string; type: EntityCandidate["entityType"] }> = {
  "nasa-breaking": { canonical: "NASA", type: "organization" },
  "usgs-all-hour": { canonical: "USGS", type: "organization" },
  "github-blog": { canonical: "GitHub", type: "technology" },
  "cisa-news": { canonical: "CISA", type: "organization" },
  "fed-press": { canonical: "Federal Reserve", type: "organization" },
  "nhc-atlantic": { canonical: "National Hurricane Center", type: "organization" },
  "nhc-east-pacific": { canonical: "National Hurricane Center", type: "organization" },
  "nws-active-alerts": { canonical: "National Weather Service", type: "organization" },
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function makeCandidate(canonicalName: string, entityType: EntityCandidate["entityType"], mentionText: string, confidence: number): EntityCandidate {
  const normalizedName = normalize(canonicalName);
  return {
    id: createHash("sha256").update(`entity\n${entityType}\n${normalizedName}`).digest("hex").slice(0, 24),
    canonicalName, normalizedName, entityType, mentionText, confidence,
  };
}

function add(found: Map<string, EntityCandidate>, canonical: string, type: EntityCandidate["entityType"], mention: string, confidence: number) {
  if (!canonical.trim()) return;
  const entity = makeCandidate(canonical.trim(), type, mention.trim() || canonical.trim(), confidence);
  found.set(entity.id, entity);
}

function structuredValue(summary: string, key: string): string | undefined {
  const marker = `${key}=`;
  const part = summary.split(" | ").find(value => value.startsWith(marker));
  return part?.slice(marker.length).trim();
}

export function extractEntities(observation: Observation): EntityCandidate[] {
  const found = new Map<string, EntityCandidate>();
  const text = normalize(`${observation.title} ${observation.summary}`);

  const sourceEntity = sourceEntities[observation.sourceId];
  if (sourceEntity) add(found, sourceEntity.canonical, sourceEntity.type, sourceEntity.canonical, 1);

  for (const [alias, target] of Object.entries(aliases)) {
    const normalizedAlias = normalize(alias);
    if (!new RegExp(`(^| )${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(text)) continue;
    add(found, target.canonical, target.type, alias, 1);
  }

  // Structured NWS observations give ARGUS deterministic event, issuer and geography entities.
  if (observation.sourceId === "nws-active-alerts") {
    const event = structuredValue(observation.summary, "event");
    const area = structuredValue(observation.summary, "area");
    const sender = structuredValue(observation.summary, "sender");
    if (event) add(found, event, "event_type", event, 1);
    if (sender) add(found, sender, "organization", sender, 1);
    if (area) {
      for (const place of area.split(/;|,/).map(value => value.trim()).filter(Boolean).slice(0, 12)) {
        add(found, place, "location", place, 0.98);
      }
    }
  }

  return [...found.values()];
}
