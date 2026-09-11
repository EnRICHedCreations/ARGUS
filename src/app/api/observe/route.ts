import { NextResponse } from "next/server";
import { collect } from "@/lib/collector";
import { detectVolumeSpike } from "@/lib/anomaly";
import { getObservations, getSignals, remember, rememberSignal } from "@/lib/memory";
import { sources } from "@/lib/sources";

export async function POST() {
  const results = await Promise.allSettled(sources.filter(s => s.enabled).map(async source => ({ source, items: await collect(source) })));
  const errors: string[] = [];
  for (const result of results) {
    if (result.status === "rejected") { errors.push(String(result.reason)); continue; }
    remember(result.value.items);
  }
  const all = getObservations();
  for (const source of sources) {
    const signal = detectVolumeSpike(source.id, all);
    if (signal) rememberSignal(signal);
  }
  return NextResponse.json({ observations: all.length, signals: getSignals(), errors });
}

export function GET() {
  return NextResponse.json({ sources, observations: getObservations().slice(0, 100), signals: getSignals() });
}
