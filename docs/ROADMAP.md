# ARGUS Roadmap

## Phase 0 — Foundation

- [x] Establish project mission and safety boundary
- [x] Define Observer / Memory / Analyst / Oracle / Voice architecture
- [x] Require operation with `LLM_PROVIDER=none`
- [ ] Scaffold application and worker packages
- [ ] Add local development environment
- [ ] Add CI gates

## Phase 1 — Observation

- [ ] Source registry
- [ ] RSS/Atom collector
- [ ] HTTP conditional requests and respectful rate limiting
- [ ] Raw-record provenance
- [ ] Normalized observation schema
- [ ] Deduplication
- [ ] Collector health metrics

## Phase 2 — Memory

- [ ] PostgreSQL persistence
- [ ] Entity model
- [ ] Entity aliases and resolution
- [ ] Temporal relationships
- [ ] Event model
- [ ] Evidence graph
- [ ] Historical queries

## Phase 3 — Analyst

- [ ] Rolling baselines
- [ ] Z-score anomaly detection
- [ ] Velocity and acceleration scoring
- [ ] Novelty scoring
- [ ] Multi-source corroboration
- [ ] Explainable significance score
- [ ] Signal queue

## Phase 4 — Oracle

- [ ] Immutable prediction ledger
- [ ] Explicit prediction horizons
- [ ] Resolution criteria
- [ ] Confidence calibration
- [ ] Automatic/manual resolution
- [ ] Brier scoring
- [ ] Historical accuracy dashboard

## Phase 5 — ARGUS Console

- [ ] Operations dashboard
- [ ] Live observation stream
- [ ] Entity explorer
- [ ] Event timeline
- [ ] Anomaly queue
- [ ] Evidence viewer
- [ ] Prediction ledger
- [ ] System health

## Phase 6 — Voice (optional)

- [ ] Natural-language query interface
- [ ] Local model provider option
- [ ] Hosted provider adapter option
- [ ] Tool-bounded access to ARGUS
- [ ] Evidence citations in every factual response
- [ ] Fact / inference / prediction labeling
- [ ] Hallucination boundary tests

## Phase 7 — Internet Game

- [ ] Expand source catalog gradually
- [ ] Geographic/public-event signals
- [ ] Open-source ecosystem signals
- [ ] Public economic/government signals
- [ ] Cross-domain event correlation
- [ ] Daily `What changed?` briefing
- [ ] Long-term prediction calibration experiments

## V1 success condition

ARGUS can continuously ingest a small set of free, permitted public sources; retain provenance; construct persistent entities/events; detect statistically unusual changes; rank them; and explain exactly why each signal was generated — without requiring an LLM API.
