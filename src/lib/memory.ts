import type { Observation, Signal } from "./types";

const memory = globalThis as typeof globalThis & { __argusObservations?: Map<string, Observation>; __argusSignals?: Map<string, Signal> };
const observations = memory.__argusObservations ??= new Map();
const signals = memory.__argusSignals ??= new Map();

export function remember(items: Observation[]) { for (const item of items) observations.set(item.fingerprint, item); }
export function rememberSignal(signal: Signal) { signals.set(signal.id, signal); }
export function getObservations() { return [...observations.values()].sort((a,b) => b.publishedAt.localeCompare(a.publishedAt)); }
export function getSignals() { return [...signals.values()].sort((a,b) => b.observedAt.localeCompare(a.observedAt)); }
