# ARGUS

**Autonomous Reasoning Graph for Unified Signals**

ARGUS is an experimental, evidence-first system that observes permitted public Internet sources, remembers what it sees, detects meaningful changes, and produces auditable signals and predictions.

ARGUS is designed to work with **no LLM at all**. An optional language model can later act as the conversational Voice, but the Algorithm remains deterministic and inspectable.

## Core principles

- Public, permitted data only.
- Evidence before inference.
- Every observation keeps its provenance.
- Facts, inferences, and predictions are distinct types.
- Predictions are immutable and scored later against outcomes.
- `LLM_PROVIDER=none` is a first-class operating mode.
- No bypassing authentication, paywalls, robots restrictions, or source rate limits.

## V0 architecture

```text
Public sources
    |
    v
Collectors -> Normalizer -> Observation Store
                              |
                              v
                         Entity Memory
                              |
                 +------------+------------+
                 |                         |
                 v                         v
          Anomaly Engine            Signal Scoring
                 |                         |
                 +------------+------------+
                              |
                              v
                       Prediction Ledger
                              |
                              v
                         ARGUS API/UI
                              |
                         optional Voice
```

## First milestone

V0 establishes the domain model and deterministic signal engine. Next milestones add PostgreSQL persistence, RSS/Atom ingestion, entity resolution, anomaly baselines, a prediction ledger, and an operations UI.

## Status

Initial build in progress.
