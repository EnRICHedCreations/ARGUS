import { NextRequest, NextResponse } from "next/server";
import { getInferences } from "@/lib/inference-store";
import { getObservations, getOutcomes, getPredictions, getSignals } from "@/lib/memory";
import { runStructuredQuery, type QueryKind } from "@/lib/query";

const allowed = new Set<QueryKind>(["summary", "observations", "signals", "inferences", "predictions", "outcomes"]);

export async function GET(request: NextRequest) {
  try {
    const kind = (request.nextUrl.searchParams.get("kind") ?? "summary") as QueryKind;
    if (!allowed.has(kind)) return NextResponse.json({ error: "unsupported_query_kind", allowed: [...allowed] }, { status: 400 });
    const source = request.nextUrl.searchParams.get("source") ?? undefined;
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const limit = rawLimit == null ? undefined : Number(rawLimit);
    const [observations, signals, inferences, predictions, outcomes] = await Promise.all([
      getObservations(), getSignals(), getInferences(), getPredictions(), getOutcomes(),
    ]);
    return NextResponse.json({
      query: { kind, source: source ?? null, limit: limit ?? 25 },
      result: runStructuredQuery({ kind, source, limit }, { observations, signals, inferences, predictions, outcomes }),
      epistemicContract: {
        observed_fact: "directly supported by collected observations",
        signal: "deterministic/statistical detection",
        inference: "derived interpretation; not an observed fact",
        prediction: "falsifiable future claim",
        outcome: "observed resolution of a prior prediction",
      },
      llmProvider: "none",
      gate: 7,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error), gate: 7 }, { status: 500 });
  }
}
