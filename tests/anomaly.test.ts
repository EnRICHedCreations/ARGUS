import test from "node:test";
import assert from "node:assert/strict";
import { detectVolumeSpike } from "../src/lib/anomaly";
import type { Observation } from "../src/lib/types";

const now = new Date("2026-09-11T16:00:00Z");
function observation(id:string, hoursAgo:number): Observation { return { id, sourceId:"test", externalId:id, title:id, url:"https://example.com", publishedAt:new Date(now.getTime()-hoursAgo*3600000).toISOString(), observedAt:now.toISOString(), summary:"", fingerprint:id }; }

test("detects a current volume spike", () => {
  const history = [1.5,2.5,3.5,4.5,5.5,6.5].map((h,i)=>observation(`old${i}`,h));
  const current = [0.1,0.2,0.3,0.4].map((h,i)=>observation(`new${i}`,h));
  const signal = detectVolumeSpike("test", [...history,...current], now);
  assert.ok(signal);
  assert.equal(signal.current, 4);
  assert.equal(signal.baseline, 1);
  assert.equal(signal.score, 4);
});

test("ignores ordinary volume", () => {
  const items = [0.2,1.2,2.2,3.2,4.2,5.2,6.2].map((h,i)=>observation(String(i),h));
  assert.equal(detectVolumeSpike("test", items, now), null);
});
