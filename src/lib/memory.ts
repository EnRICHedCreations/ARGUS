import type { Observation, Signal } from "./types";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ARGUS persistent memory requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

async function request(path: string, init?: RequestInit) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`ARGUS memory request failed (${response.status}): ${body.slice(0, 500)}`);
  if (!body.trim()) return null;
  try { return JSON.parse(body); }
  catch { throw new Error(`ARGUS memory returned invalid JSON (${response.status}): ${body.slice(0, 500)}`); }
}

export async function remember(items: Observation[]) {
  if (!items.length) return;
  await request("argus_observations?on_conflict=fingerprint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(items.map(item => ({
      fingerprint: item.fingerprint, id: item.id, source_id: item.sourceId, external_id: item.externalId,
      title: item.title, url: item.url, published_at: item.publishedAt, observed_at: item.observedAt, summary: item.summary,
    }))),
  });
}

export async function rememberSignal(signal: Signal) {
  await request("argus_signals?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: signal.id, kind: signal.kind, source_id: signal.sourceId, observed_at: signal.observedAt,
      score: signal.score, baseline: signal.baseline, current_value: signal.current,
      evidence_observation_ids: signal.evidenceObservationIds }),
  });
}

export async function getObservations(): Promise<Observation[]> {
  const rows = (await request("argus_observations?select=id,source_id,external_id,title,url,published_at,observed_at,summary,fingerprint&order=published_at.desc&limit=5000") ?? []) as Array<Record<string, unknown>>;
  return rows.map(row => ({ id: String(row.id), sourceId: String(row.source_id), externalId: String(row.external_id),
    title: String(row.title), url: String(row.url), publishedAt: String(row.published_at), observedAt: String(row.observed_at),
    summary: String(row.summary ?? ""), fingerprint: String(row.fingerprint) }));
}

export async function getSignals(): Promise<Signal[]> {
  const rows = (await request("argus_signals?select=id,kind,source_id,observed_at,score,baseline,current_value,evidence_observation_ids&order=observed_at.desc&limit=1000") ?? []) as Array<Record<string, unknown>>;
  return rows.map(row => ({ id: String(row.id), kind: "volume_spike", sourceId: String(row.source_id), observedAt: String(row.observed_at),
    score: Number(row.score), baseline: Number(row.baseline), current: Number(row.current_value),
    evidenceObservationIds: Array.isArray(row.evidence_observation_ids) ? row.evidence_observation_ids.map(String) : [] }));
}
