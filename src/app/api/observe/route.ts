import { NextResponse } from "next/server";
import { collect } from "@/lib/collector";
import { detectVolumeSpike } from "@/lib/anomaly";
import { getObservations, getSignals, remember, rememberSignal } from "@/lib/memory";
import { sources } from "@/lib/sources";

export async function POST() {
  try {
    const results = await Promise.allSettled(sources.filter(s => s.enabled).map(async source => ({ source, items: await collect(source) })));
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(String(result.reason));
        continue;
      }
      await remember(result.value.items);
    }

    const all = await getObservations();
    for (const source of sources) {
      const signal = detectVolumeSpike(source.id, all);
      if (signal) await rememberSignal(signal);
    }

    return NextResponse.json({ observations: all.length, signals: await getSignals(), errors, memory: "persistent" });
  } catch (error) {
    return NextResponse.json({ error: String(error), memory: "persistent" }, { status: 500 });
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
