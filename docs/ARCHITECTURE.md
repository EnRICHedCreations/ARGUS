# ARGUS Architecture

## Boundary

ARGUS observes permitted public Internet data. It is not a covert surveillance system and does not attempt to defeat authentication, access controls, paywalls, robots restrictions, or rate limits.

## Five logical subsystems

### 1. Observer
Collectors retrieve public signals from explicitly configured sources. Each collector emits raw source records and provenance metadata.

### 2. Memory
Normalized observations are stored as append-oriented evidence. Entities and relationships form a temporal world model rather than replacing historical state.

### 3. Analyst
Deterministic/statistical processes establish baselines, detect deviations, correlate observations, and calculate significance scores.

### 4. Oracle
Predictions are explicit records containing a proposition, evidence set, confidence, creation time, resolution criteria, horizon, and eventual score. Predictions are never silently rewritten after creation.

### 5. Voice
An optional interface translates natural-language questions into bounded ARGUS queries and explains returned evidence. It is not authoritative. ARGUS must remain functional when `LLM_PROVIDER=none`.

## Evidence model

Every meaningful conclusion should be traceable through:

`source -> raw record -> observation -> entity/event -> signal -> inference/prediction`

Each layer records timestamps, provenance, confidence where applicable, and references to its inputs.

## Initial data types

- Source
- Observation
- Entity
- Relationship
- Event
- Signal
- Prediction
- PredictionResolution

## Initial signal methods

V0/V1 should favor understandable methods before sophisticated ML:

- moving averages
- z-scores
- rate-of-change
- trend acceleration
- source corroboration
- novelty scoring
- change-point detection
- graph centrality changes

## Non-goals for V0

- crawling the entire Internet
- autonomous consequential actions
- hidden/private data collection
- facial/person tracking
- opaque model-generated facts
- dependence on a paid LLM API
