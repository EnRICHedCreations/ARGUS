import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { Observation, Source } from "./types";

const parser = new Parser();

function observationId(sourceId: string, externalId: string, title: string) {
  const fingerprint = createHash("sha256").update(`${sourceId}\n${externalId}\n${title}`).digest("hex");
  return { fingerprint, id: fingerprint.slice(0, 24) };
}

async function collectNwsAlerts(source: Source): Promise<Observation[]> {
  const observedAt = new Date().toISOString();
  const response = await fetch(source.url, {
    headers: {
      Accept: "application/geo+json",
      "User-Agent": "ARGUS intelligence observer (https://argus.apps.deployhatch.com)"
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`NWS API ${response.status}`);

  const payload = await response.json() as { features?: Array<{ id?: string; properties?: Record<string, unknown> }> };
  return (payload.features || []).map((feature, index) => {
    const p = feature.properties || {};
    const title = String(p.headline || p.event || "NWS active alert").trim();
    const externalId = String(feature.id || p.id || `${p.sent || observedAt}:${index}`);
    const publishedAt = new Date(String(p.sent || p.effective || observedAt)).toISOString();
    const url = String(p["@id"] || feature.id || source.url);
    const structured = [
      p.event && `event=${p.event}`,
      p.severity && `severity=${p.severity}`,
      p.urgency && `urgency=${p.urgency}`,
      p.certainty && `certainty=${p.certainty}`,
      p.areaDesc && `area=${p.areaDesc}`,
      p.senderName && `sender=${p.senderName}`,
      p.description && `description=${String(p.description).replace(/\s+/g, " ")}`
    ].filter(Boolean).join(" | ").slice(0, 1000);
    const { fingerprint, id } = observationId(source.id, externalId, title);
    return { id, sourceId: source.id, externalId, title, url, publishedAt, observedAt, summary: structured, fingerprint };
  });
}

export async function collect(source: Source): Promise<Observation[]> {
  if (!source.enabled) return [];
  if (source.kind === "nws_alerts_json") return collectNwsAlerts(source);

  const feed = await parser.parseURL(source.url);
  const observedAt = new Date().toISOString();

  return feed.items.map((item, index) => {
    const title = item.title?.trim() || "Untitled observation";
    const url = item.link || source.url;
    const publishedAt = new Date(item.isoDate || item.pubDate || observedAt).toISOString();
    const externalId = item.guid || item.id || url || `${publishedAt}:${index}`;
    const summary = String(item.contentSnippet || item.content || "").replace(/\s+/g, " ").trim().slice(0, 1000);
    const { fingerprint, id } = observationId(source.id, externalId, title);
    return { id, sourceId: source.id, externalId, title, url, publishedAt, observedAt, summary, fingerprint };
  });
}
