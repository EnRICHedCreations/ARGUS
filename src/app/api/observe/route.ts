import { NextResponse } from "next/server";
import { collect } from "@/lib/collector";
import { detectVolumeSpike } from "@/lib/anomaly";
import { runAnalyst } from "@/lib/analyst";
import { extractEntities } from "@/lib/entities";
import { generatePredictions } from "@/lib/oracle";
import { deriveRelationships } from "@/lib/relationships";
import { getAnalystEvidence, getEntityStats, getGraphStats, getObservations, getPredictions, getSignals, remember, rememberEntityGraph, rememberPredictions, rememberSignals } from "@/lib/memory";
import { sources } from "@/lib/sources";

export async function POST() {
  const errors: string[] = [];
  try {
    const results = await Promise.allSettled(
      sources.filter(source => source.enabled).map(async source => ({ source, items: await collect(source) }))
    );

    const collected = [] as Array<{ source: (typeof sources)[number]; items: Awaited<ReturnType<typeof collect>> }>;
    for (const result of results) {
      if (result.status === "rejected") errors.push(`collector: ${String(result.reason)}`);
      else collected.push(result.value);
    }

    const items = collected.flatMap(result => result.items);
    try { await remember(items); }
    catch (error) { errors.push(`memory:batch: ${String(error)}`); }

    const graphEntries = items.map(observation => {
      const entities = extractEntities(observation);
      return { observation, entities, relationships: deriveRelationships(observation, entities) };
    });

    try { await rememberEntityGraph(graphEntries); }
    catch (error) { errors.push(`graph:batch: ${String(error)}`); }

    const all = await getObservations();
    const legacySignals = sources
      .map(source => detectVolumeSpike(source.id, all))
      .filter((signal): signal is NonNullable<typeof signal> => signal != null);

    let analystSignals = [] as ReturnType<typeof runAnalyst>;
    try { analystSignals = runAnalyst(all, await getAnalystEvidence()); }
    catch (error) { errors.push(`analyst: ${String(error)}`); }

    const signals = [...legacySignals, ...analystSignals];
    try { await rememberSignals(signals); }
    catch (error) { errors.push(`signals:batch: ${String(error)}`); }

    const predictions = generatePredictions(signals);
    try { await rememberPredictions(predictions); }
    catch (error) { errors.push(`predictions:batch: ${String(error)}`); }

    const persistedPredictions = await getPredictions();
    return NextResponse.json({
      observations: all.length,
      signals: await getSignals(),
      predictions: persistedPredictions,
      errors,
      memory: "persistent",
      entities: await getEntityStats(),
      graph: await getGraphStats(),
      analyst: { detectorCount: 8, generatedThisRun: signals.length, kinds: [...new Set(signals.map(signal => signal.kind))] },
      oracle: { generatedThisRun: predictions.length, openPredictions: persistedPredictions.filter(prediction => prediction.status === "open").length, modelVersion: "deterministic_oracle_v1" },
      persistence: "batched",
      gate: 5,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error), errors, memory: "persistent", persistence: "batched", gate: 5 }, { status: 500 });
  }
}

export async function GET() {
  try {
    const signals = await getSignals();
    const predictions = await getPredictions();
    return NextResponse.json({
      sources,
      observations: (await getObservations()).slice(0, 100),
      signals,
      predictions,
      entities: await getEntityStats(),
      graph: await getGraphStats(),
      analyst: { detectorCount: 8, persistedSignalKinds: [...new Set(signals.map(signal => signal.kind))] },
      oracle: { openPredictions: predictions.filter(prediction => prediction.status === "open").length, modelVersion: "deterministic_oracle_v1" },
      memory: "persistent",
      persistence: "batched",
      gate: 5,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error), memory: "persistent", persistence: "batched", gate: 5 }, { status: 500 });
  }
}
