import type { Inference } from "./inference";

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
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`ARGUS inference memory request failed (${response.status}): ${body.slice(0, 500)}`);
  if (!body.trim()) return null;
  return JSON.parse(body);
}

export async function rememberInferences(inferences: Inference[]) {
  if (!inferences.length) return;
  await request("argus_inferences?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(inferences.map(inference => ({
      id: inference.id,
      signal_id: inference.signalId,
      inference_type: inference.inferenceType,
      subject_scope: inference.subjectScope,
      statement: inference.statement,
      inferred_at: inference.inferredAt,
      confidence: inference.confidence,
      derivation_method: inference.derivationMethod,
      evidence_observation_ids: inference.evidenceObservationIds,
      details: inference.details,
    }))),
  });
}

export async function getInferences(): Promise<Inference[]> {
  const rows = (await request("argus_inferences?select=id,signal_id,inference_type,subject_scope,statement,inferred_at,confidence,derivation_method,evidence_observation_ids,details&order=inferred_at.desc&limit=1000") ?? []) as Array<Record<string, unknown>>;
  return rows.map(row => ({
    id: String(row.id),
    signalId: String(row.signal_id),
    inferenceType: String(row.inference_type) as Inference["inferenceType"],
    subjectScope: String(row.subject_scope),
    statement: String(row.statement),
    inferredAt: String(row.inferred_at),
    confidence: Number(row.confidence),
    derivationMethod: "deterministic_signal_interpretation_v1",
    evidenceObservationIds: Array.isArray(row.evidence_observation_ids) ? row.evidence_observation_ids.map(String) : [],
    details: row.details && typeof row.details === "object" ? row.details as Record<string, unknown> : {},
  }));
}
