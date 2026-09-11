"use client";
import { useState } from "react";

type Signal = { id: string; sourceId: string; score: number; current: number; baseline: number };
type Result = { observations: number; signals: Signal[]; errors: string[]; memory?: string };

export default function Home() {
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  async function observe() {
    setRunning(true);
    setRequestError(null);
    try {
      const response = await fetch("/api/observe", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setRequestError(body?.error ? String(body.error) : `Observe request failed with HTTP ${response.status}`);
        return;
      }
      setResult({
        observations: Number(body?.observations ?? 0),
        signals: Array.isArray(body?.signals) ? body.signals : [],
        errors: Array.isArray(body?.errors) ? body.errors.map(String) : [],
        memory: body?.memory ? String(body.memory) : undefined,
      });
    } catch (error) {
      setRequestError(String(error));
    } finally {
      setRunning(false);
    }
  }

  return <main>
    <p className="eyebrow">AUTONOMOUS REASONING GRAPH FOR UNIFIED SIGNALS</p>
    <h1>ARGUS</h1>
    <p className="status"><span /> ALGORITHM ONLINE · LLM_PROVIDER=none</p>
    <section>
      <h2>Observation Gate 1</h2>
      <p>Collect permitted public feeds, normalize observations, preserve provenance, persist memory, and run deterministic anomaly detection.</p>
      <button onClick={observe} disabled={running}>{running ? "OBSERVING…" : "OBSERVE NOW"}</button>
    </section>
    <div className="grid">
      <article><b>OBSERVATIONS</b><strong>{result?.observations ?? "—"}</strong></article>
      <article><b>SIGNALS</b><strong>{result?.signals.length ?? "—"}</strong></article>
      <article><b>COLLECTOR ERRORS</b><strong>{result?.errors.length ?? "—"}</strong></article>
    </div>
    {requestError ? <section><h2>Observation error</h2><pre>{requestError}</pre></section> : null}
    {result?.signals.map(s => <section key={s.id}><h2>ANOMALY · {s.sourceId}</h2><p>Current volume {s.current}; baseline {s.baseline.toFixed(2)} per hour; anomaly score {s.score.toFixed(2)}.</p></section>)}
    {result?.errors.length ? <section><h2>Collector diagnostics</h2>{result.errors.map((e,i)=><pre key={i}>{e}</pre>)}</section> : null}
  </main>;
}
