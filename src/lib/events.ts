import { createHash } from "node:crypto";
import type { Observation } from "./types";

export type ArgusEvent = {
  id: string;
  eventType: string;
  sourceId: string;
  title: string;
  effectiveAt?: string;
  expiresAt?: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  area?: string;
  issuer?: string;
  status: "observed";
  details: Record<string, unknown>;
  firstObservedAt: string;
  lastObservedAt: string;
  evidenceObservationIds: string[];
};

function value(summary: string, key: string) {
  const prefix = `${key}=`;
  return summary.split(" | ").find(part => part.startsWith(prefix))?.slice(prefix.length).trim();
}

export function deriveEvents(observation: Observation): ArgusEvent[] {
  if (observation.sourceId !== "nws-active-alerts") return [];
  const eventType = value(observation.summary, "event");
  if (!eventType) return [];
  const id = createHash("sha256").update(`event\nnws\n${observation.externalId}`).digest("hex").slice(0, 24);
  return [{
    id,
    eventType,
    sourceId: observation.sourceId,
    title: observation.title,
    effectiveAt: observation.publishedAt,
    severity: value(observation.summary, "severity"),
    urgency: value(observation.summary, "urgency"),
    certainty: value(observation.summary, "certainty"),
    area: value(observation.summary, "area"),
    issuer: value(observation.summary, "sender"),
    status: "observed",
    details: { externalId: observation.externalId, url: observation.url },
    firstObservedAt: observation.observedAt,
    lastObservedAt: observation.observedAt,
    evidenceObservationIds: [observation.id],
  }];
}
