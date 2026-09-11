import { NextResponse } from "next/server";
import { collect } from "@/lib/collector";
import { detectVolumeSpike } from "@/lib/anomaly";
import { getObservations, getSignals, remember, rememberSignal } from "@/lib/memory";
import { sources } from "@/lib/sources";

export async function POST() {
  const errors: string[] = [];

  try {
    const results = await Promise.allSettled(
      sources.filter(s => s.enabled).map(async source => ({ source, items: await collect(source) }))
    );

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(`collector: ${String(result.reason)}`);
        continue;
      }

      try {
        await remember(result.value.items);
      } catch (error) {
        errors.push(`memory:${result.value.source.id}: ${String(error)}`);
      }
    }

    const all = await getObservations();
    for (const source of sources) {
      const signal = detectVolumeSpike(source.id, all);
      if (!signal) continue;
      try {
        await rememberSignal(signal);
      } catch (error) {
        errors.push(`signal:${source.id}: ${String(error)}`);
      }
    }

    return NextResponse.json({
      observations: all.length,
      signals: await getSignals(),
      errors,
      memory: "persistent",
    });
  } catch (error) {
    return NextResponse.json({ error: String(error), errors, memory: "persistent" }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      sources,
      observations: (await getObservations()).slice(0, 100),
      signals: await getSignals(),
      memory: "persistent",
    });
  } catch (error) {
    return NextResponse.json({ error: String(error), memory: "persistent" }, { status: 500 });
  }
}
