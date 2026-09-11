import type { ArgusEvent } from "./events";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ARGUS persistent memory requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

async function request(path: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { url, key } = config();
  for (let i = 0; i < rows.length; i += 250) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: "POST",
      cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 250)),
    });
    if (!response.ok) throw new Error(`ARGUS event memory failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
}

export async function rememberEvents(events: ArgusEvent[]) {
  const unique = [...new Map(events.map(event => [event.id, event])).values()];
  await request("argus_events?on_conflict=id", unique.map(event => ({
    id: event.id, event_type: event.eventType, source_id: event.sourceId, title: event.title,
    effective_at: event.effectiveAt ?? null, expires_at: event.expiresAt ?? null,
    severity: event.severity ?? null, urgency: event.urgency ?? null, certainty: event.certainty ?? null,
    area: event.area ?? null, issuer: event.issuer ?? null, status: event.status, details: event.details,
    first_observed_at: event.firstObservedAt, last_observed_at: event.lastObservedAt,
  })));
  await request("argus_observation_events?on_conflict=observation_id,event_id", unique.flatMap(event => event.evidenceObservationIds.map(observationId => ({ observation_id: observationId, event_id: event.id, derivation_method: "deterministic_nws_event_v1", confidence: 1 }))));
}

export async function getEventStats() {
  const { url, key } = config();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [eventsResponse, linksResponse] = await Promise.all([
    fetch(`${url}/rest/v1/argus_events?select=id,event_type,severity,urgency,certainty`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/argus_observation_events?select=observation_id,event_id`, { headers, cache: "no-store" }),
  ]);
  if (!eventsResponse.ok || !linksResponse.ok) throw new Error("ARGUS event stats unavailable");
  const events = await eventsResponse.json() as Array<Record<string, unknown>>;
  const links = await linksResponse.json() as Array<Record<string, unknown>>;
  return { events: events.length, observationEventLinks: links.length, eventTypes: new Set(events.map(row => String(row.event_type))).size };
}
