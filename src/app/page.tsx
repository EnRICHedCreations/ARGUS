"use client";
import { useEffect, useMemo, useState } from "react";

type Observation = { id:string; sourceId:string; title:string; publishedAt:string; url:string };
type Signal = { id:string; kind:string; sourceId:string; score:number; observedAt:string; evidenceObservationIds:string[] };
type Inference = { id:string; inferenceType:string; subjectScope:string; statement:string; confidence:number; inferredAt:string; evidenceObservationIds:string[] };
type Prediction = { id:string; statement:string; probability:number; status:string; resolvesAt:string; subjectScope:string };
type Outcome = { id:string; predictionId:string; outcome:boolean; actualValue:number; targetValue:number; brierScore:number; resolvedAt:string };
type QueryResponse<T> = { result:T; llmProvider:string; epistemicContract?:Record<string,string> };

type Snapshot = {
  observations: Observation[];
  signals: Signal[];
  inferences: Inference[];
  predictions: Prediction[];
  outcomes: Outcome[];
};

const empty: Snapshot = { observations:[], signals:[], inferences:[], predictions:[], outcomes:[] };
const tabs = ["overview","observations","signals","inferences","predictions","outcomes"] as const;
type Tab = typeof tabs[number];

async function query<T>(kind:string, limit=100):Promise<T> {
  const response = await fetch(`/api/query?kind=${kind}&limit=${limit}`, { cache:"no-store" });
  const body: QueryResponse<T> = await response.json();
  if (!response.ok) throw new Error((body as any)?.error ?? `Query failed: ${response.status}`);
  return body.result;
}

function age(ts:string) {
  const seconds = Math.max(0, Math.floor((Date.now()-new Date(ts).getTime())/1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
  return `${Math.floor(seconds/3600)}h ago`;
}

export default function Home() {
  const [data,setData] = useState<Snapshot>(empty);
  const [tab,setTab] = useState<Tab>("overview");
  const [loading,setLoading] = useState(true);
  const [observing,setObserving] = useState(false);
  const [error,setError] = useState<string|null>(null);

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const [observations,signals,inferences,predictions,outcomes] = await Promise.all([
        query<Observation[]>("observations"), query<Signal[]>("signals"), query<Inference[]>("inferences"), query<Prediction[]>("predictions"), query<Outcome[]>("outcomes"),
      ]);
      setData({observations,signals,inferences,predictions,outcomes});
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function observe() {
    setObserving(true); setError(null);
    try {
      const response = await fetch("/api/observe", { method:"POST" });
      const body = await response.json().catch(()=>null);
      if (!response.ok) throw new Error(body?.error ?? `Observe failed: ${response.status}`);
      if (Array.isArray(body?.errors) && body.errors.length) setError(body.errors.join("\n"));
      await refresh();
    } catch(e) { setError(String(e)); }
    finally { setObserving(false); }
  }

  useEffect(()=>{ void refresh(); },[]);

  const openPredictions = useMemo(()=>data.predictions.filter(p=>p.status==="open"),[data.predictions]);
  const resolvedPredictions = useMemo(()=>data.predictions.filter(p=>p.status==="resolved"),[data.predictions]);
  const meanBrier = data.outcomes.length ? data.outcomes.reduce((s,o)=>s+o.brierScore,0)/data.outcomes.length : null;
  const latestInference = data.inferences[0];

  return <main>
    <header className="hero">
      <div><p className="eyebrow">AUTONOMOUS REASONING GRAPH FOR UNIFIED SIGNALS</p><h1>ARGUS</h1></div>
      <div className="hero-side"><p className="status"><span/> ONLINE · LLM_PROVIDER=none</p><button onClick={observe} disabled={observing}>{observing?"OBSERVING…":"OBSERVE NOW"}</button></div>
    </header>

    <nav>{tabs.map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t.toUpperCase()}</button>)}</nav>
    {error ? <section className="error"><b>DIAGNOSTIC</b><pre>{error}</pre></section> : null}

    {tab==="overview" && <>
      <div className="grid six">
        <article><b>OBSERVATIONS</b><strong>{data.observations.length}</strong></article>
        <article><b>SIGNALS</b><strong>{data.signals.length}</strong></article>
        <article><b>INFERENCES</b><strong>{data.inferences.length}</strong></article>
        <article><b>OPEN PREDICTIONS</b><strong>{openPredictions.length}</strong></article>
        <article><b>OUTCOMES</b><strong>{data.outcomes.length}</strong></article>
        <article><b>MEAN BRIER</b><strong>{meanBrier==null?"—":meanBrier.toFixed(3)}</strong></article>
      </div>
      <section><h2>CURRENT INTELLIGENCE</h2>{latestInference?<><p className="classification">INFERENCE · {latestInference.inferenceType}</p><p className="lead">{latestInference.statement}</p><p className="muted">Confidence {(latestInference.confidence*100).toFixed(1)}% · {latestInference.evidenceObservationIds.length} evidence observations · {age(latestInference.inferredAt)}</p></>:<p className="muted">No current inference.</p>}</section>
      <div className="split"><section><h2>ACTIVE ORACLE</h2>{openPredictions.length?openPredictions.slice(0,3).map(p=><div className="row" key={p.id}><span className="classification">PREDICTION</span><p>{p.statement}</p><small>{(p.probability*100).toFixed(1)}% · resolves {new Date(p.resolvesAt).toLocaleString()}</small></div>):<p className="muted">No open predictions.</p>}</section><section><h2>RECENT OUTCOMES</h2>{data.outcomes.length?data.outcomes.slice(0,3).map(o=><div className="row" key={o.id}><span className="classification">OUTCOME · {o.outcome?"CONFIRMED":"MISSED"}</span><p>Actual {o.actualValue} / target {o.targetValue}</p><small>Brier {o.brierScore.toFixed(4)} · {age(o.resolvedAt)}</small></div>):<p className="muted">No resolved outcomes.</p>}</section></div>
    </>}

    {tab==="observations" && <section><h2>LIVE OBSERVATION STREAM</h2>{data.observations.map(o=><div className="row" key={o.id}><span className="classification">OBSERVED FACT · {o.sourceId}</span><p><a href={o.url} target="_blank">{o.title}</a></p><small>{new Date(o.publishedAt).toLocaleString()}</small></div>)}</section>}
    {tab==="signals" && <section><h2>ANOMALY / SIGNAL QUEUE</h2>{data.signals.map(s=><div className="row" key={s.id}><span className="classification">SIGNAL · {s.kind}</span><p>{s.sourceId} · score {Number(s.score).toFixed(2)}</p><small>{s.evidenceObservationIds?.length??0} evidence observations · {age(s.observedAt)}</small></div>)}</section>}
    {tab==="inferences" && <section><h2>INFERENCE LEDGER</h2>{data.inferences.map(i=><div className="row" key={i.id}><span className="classification">INFERENCE · {i.inferenceType}</span><p>{i.statement}</p><small>Confidence {(i.confidence*100).toFixed(1)}% · {i.evidenceObservationIds.length} evidence observations · {age(i.inferredAt)}</small></div>)}</section>}
    {tab==="predictions" && <section><h2>PREDICTION LEDGER</h2>{data.predictions.map(p=><div className="row" key={p.id}><span className="classification">PREDICTION · {p.status}</span><p>{p.statement}</p><small>{(p.probability*100).toFixed(1)}% · resolves {new Date(p.resolvesAt).toLocaleString()}</small></div>)}</section>}
    {tab==="outcomes" && <section><h2>OUTCOME / CALIBRATION LEDGER</h2>{data.outcomes.map(o=><div className="row" key={o.id}><span className="classification">OUTCOME · {o.outcome?"CONFIRMED":"MISSED"}</span><p>Actual {o.actualValue}; target {o.targetValue}; absolute error {Math.abs(o.actualValue-o.targetValue)}</p><small>Brier {o.brierScore.toFixed(6)} · resolved {new Date(o.resolvedAt).toLocaleString()}</small></div>)}</section>}

    <footer><span>{loading?"QUERYING MEMORY…":"STRUCTURED QUERY ONLINE"}</span><span>OBSERVE → REMEMBER → MODEL → DETECT → CONNECT → INFER → PREDICT → VERIFY → LEARN → EXPLAIN</span></footer>
  </main>;
}
