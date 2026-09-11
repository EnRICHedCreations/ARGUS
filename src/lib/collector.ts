import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { Observation, Source } from "./types";

const parser = new Parser();

export async function collect(source: Source): Promise<Observation[]> {
  if (!source.enabled) return [];
  const feed = await parser.parseURL(source.url);
  const observedAt = new Date().toISOString();

  return feed.items.map((item, index) => {
    const title = item.title?.trim() || "Untitled observation";
    const url = item.link || source.url;
    const publishedAt = new Date(item.isoDate || item.pubDate || observedAt).toISOString();
    const externalId = item.guid || item.id || url || `${publishedAt}:${index}`;
    const summary = String(item.contentSnippet || item.content || "").replace(/\s+/g, " ").trim().slice(0, 1000);
    const fingerprint = createHash("sha256").update(`${source.id}\n${externalId}\n${title}`).digest("hex");

    return {
      id: fingerprint.slice(0, 24), sourceId: source.id, externalId,
      title, url, publishedAt, observedAt, summary, fingerprint
    };
  });
}
