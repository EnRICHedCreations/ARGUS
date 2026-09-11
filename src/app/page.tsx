"use client";
import { useState } from "react";

type Result = { observations: number; signals: Array<{id:string;sourceId:string;score:number;current:number;baseline:number}>; errors: string[] };
export default function Home() {
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  async function observe() {
    setRunning(true);
    try { setResult(await (await fetch("/api/observe", { method: "POST" })).json()); }
    finally { setRunning(false); }
  }
  return <main>
    <p className="eyebrow">AUTONOMOUS REASONING GRAPH FOR UNIFIED SIGNALS</p>
    <h1>ARGUS</h1>
    <p className="status"><span /> ALGORITHM ONLINE · LLM_PROVIDER=none</p>
    <section>
      <h2>Observation Gate 0</h2>
      <p>Collect permitted public feeds, normalize observations, preserve provenance, and run the first deterministic anomaly detector.</p>
      <button onClick={observe} disabled={running}>{running ? "OBSERVING…" : "OBSERVE NOW"}</button>
    </section>
    <div className="grid">
      <article><b>OBSERVATIONS</b><strong>{result?.observations ?? "—"}</strong></article>
      <article><b>SIGNALS</b><strong>{result?.signals.length ?? "—"}</strong></article>
      <article><b>COLLECTOR ERRORS</b><strong>{result?.errors.length ?? "—"}</strong></article>
    </div>
    {result?.signals.map(s => <section key={s.id}><h2>ANOMALY · {s.sourceId}</h2><p>Current volume {s.current}; baseline {s.baseline.toFixed(2)} per hour; anomaly score {s.score.toFixed(2)}.</p></section>)}
    {result?.errors.length ? <section><h2>Collector diagnostics</h2>{result.errors.map((e,i)=><pre key={i}>{e}</pre>)}</section> : null}
  </main>;
}
