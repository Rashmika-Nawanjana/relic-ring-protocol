# Team Task Breakdown

## Phase 1 — Complete

Phase 1 delivered the physics engine, codec, Dijkstra router, 3D simulator, packet trace, latency breakdown, and node/link kill resilience. See [README.md](./README.md) and [problem.md](./problem.md).

**Do not discard Phase 1.** The physics-based baseline router remains the foundation for Phase 2.

---

## Phase 2 — The Relic Ring, Under Siege

**Brief:** [phase2.md](./phase2.md)  
**Data:** [challenge/](./challenge/) (config + 3 training CSVs)  
**Live API:** `https://chimera.launch26.space` (`GET /links`, `GET /state` with `X-Team-Key`)

### What changed

| Phase 1 (done) | Phase 2 (new) |
|----------------|---------------|
| Physics-only Dijkstra | **CoPilot agent** in front of baseline router |
| Implicit void edges from geometry | **12 explicit links** with `capacity_units` in `challenge/universe-config.json` |
| Static routing | **Live Chimera API** — poll `/state` on demo day |
| Structured origin/dest inputs | **Natural-language request parsing** |
| Route once | **Sequential node-by-node** evaluation with 3 analytical tools per hop |
| Basic packet schema | **Mandatory unified report** with `link_evaluations[]` |

### Training data (Day 1 only — do not train on build-period `/state`)

| File | Model |
|------|--------|
| `challenge/link_traffic_history.csv` | Congestion penalty |
| `challenge/link_telemetry.csv` | Trust score (self vs measured) |
| `challenge/link_incident_history.csv` | Targeting risk (traffic_share → jammed) |

Column reference: [challenge/DATASETS.md](./challenge/DATASETS.md)

### Architecture

```
User NL request
    → Parser (origin, destination, message)
    → Baseline physics route (Phase 1 findRoute)
    → CoPilot agent (sequential, per-hop)
         ├─ congestion tool
         ├─ trust tool
         └─ targeting-risk tool
    → True-cost router (override if needed)
    → Unified CopilotReport JSON + 3D UI
```

---

## Person 1 — Intelligence & Models
*"The Analyst"*

### Owns
Turning CSV history into the three scoring functions the agent calls as tools.

### Files to own
```
challenge/models/           # or src/lib/chimera/models/
  congestion.ts             # predict penalty_ms from load_ratio, status, history
  trust.ts                  # trust_score 0–1 from self vs measured delta
  targeting.ts              # targeting_risk 0–1 from traffic_share patterns
  train.ts                  # offline training + evaluation scripts
  findings.md               # intelligence walkthrough doc for judges
```

### Tasks in order

**Day 1**
1. EDA on all 3 CSVs — saturation threshold (~0.90), penalty curve, spoofed links (large self vs measured gaps)
2. Flag links with systematic telemetry lies (for `findings.md`)
3. Define model **input/output contracts** (Person 2 depends on this by EOD):

```typescript
congestion.predict(link_id, live_state) → { penalty_ms, saturated: boolean }
trust.score(link_id, live_state) → { trust_score: 0–1 }
targeting.risk(link_id, live_state, our_traffic_history) → { risk_score: 0–1 }
```

**Day 2**
4. Train congestion model: `load_ratio` → `observed_latency_ms` delta over baseline physics; detect `status === "saturated"` boundary
5. Train trust model: `|self_reported - measured|` patterns per link; separate noise from Chimera spoofing
6. Train targeting model: `traffic_share` + history → `jammed_flag` probability

**Day 3**
7. Export models as callable functions (keep explainable for Decision Audit)
8. Write `findings.md`: which links lie, congestion scaling formula, targeting thresholds
9. Unit tests on held-out ticks

**Live day**
10. Lead Decision Audit — explain any `link_evaluations` record to judges without looking at code

### Success criteria
- Congestion penalty correlates with `observed_latency_ms` on validation ticks
- Trust model flags known bad links without killing honest noisy links
- Targeting model predicts jams when `traffic_share` is high

---

## Person 2 — CoPilot Agent & Routing
*"The Architect"*

### Owns
Agent loop, live API, true-cost routing, and mandatory output schema.

### Files to own
```
src/lib/chimera/
  client.ts                 # GET /links, GET /state (X-Team-Key)
  state-cache.ts            # poll interval, tick tracking, saturated link set
src/lib/copilot/
  parser.ts                 # NL → { origin_id, destination_id, message }
  tools.ts                  # wraps Person 1's 3 models as agent tools
  agent.ts                  # sequential node-by-node evaluation loop
  cost.ts                   # combined_cost = physics + penalty + trust + risk
  router.ts                 # Dijkstra on dynamic true-cost graph
  schema.ts                 # unified report type + validator
src/app/api/copilot/route.ts
```

### Tasks in order

**Day 1**
1. Chimera API client — `GET /`, `GET /links`, `GET /state` with `CHIMERA_TEAM_KEY` env var
2. Handle `status: "saturated"` and `self_reported_latency_ms: null` as **hard unavailable** (not latency 0)
3. NL parser: regex + optional LLM fallback — extract origin, destination, message from free text
4. Wire Phase 1 `findRoute()` as **baseline physics route** (unchanged)

**Day 2**
5. **Sequential agent loop** (core requirement):

```
1. Parse NL request
2. baseline_path = physics_route(origin, dest)
3. FOR each hop in baseline_path:
     a. tool: congestion(link)
     b. tool: trust(link)
     c. tool: targeting_risk(link)
     d. compute combined_cost
     e. IF link unsafe → reroute locally or abort with explanation
4. Emit unified report
```

6. True-cost graph router: edge weight = physics + congestion_penalty + (1-trust)*penalty + risk*penalty
7. Route entropy: penalize links with high `traffic_share` even if physics-optimal
8. Output exact schema from phase2.md:

```json
{
  "origin_id": "Caelum",
  "destination_id": "Aegis",
  "chosen_path": ["Caelum", "Elysium", "Aegis"],
  "link_evaluations": [
    {
      "link_id": "Caelum-Elysium",
      "predicted_congestion_penalty_ms": 12.4,
      "trust_score": 0.91,
      "targeting_risk_score": 0.18,
      "combined_cost": 44.2
    }
  ],
  "final_latency_estimate_ms": 88.7,
  "explanation": "Avoided direct link: trust score 0.31 (Chimera footprint flagged), routed via detour."
}
```

`link_id` must always be alphabetical (e.g. `Aegis-Elysium`, not `Elysium-Aegis`).

**Day 3**
9. Live chaos handler: if top link severed mid-flight → re-poll `/state` → reroute without crash
10. Novel event fallback: if uncertainty high → flag in `explanation`, pick safest path
11. Integration tests with mock `/state` responses

**Live day**
12. Operate system during Live Chaos Test + Unseen Vector

### Success criteria
- Every routing decision produces valid unified schema (no missing fields)
- Saturated links never selected
- Reroute works when Council severs the busiest link in your path

---

## Person 3 — Integration, UI & Demo
*"The Operator"*

### Owns
Config merge, UI, docs, demo readiness, keeping Phase 1 working.

### Files to own
```
challenge/universe-config.json    → promoted into app config loader
src/components/ChimeraPanel.tsx   # live link health, scores, explanation
src/components/CopilotTrace.tsx   # link_evaluations table
src/components/LinkHealthOverlay  # 3D link colors from /state
README.md                         # Phase 2 section
docs/PHASE2_DEMO.md               # evaluation trial script
.env.local.example                # CHIMERA_API_URL, CHIMERA_TEAM_KEY
```

### Tasks in order

**Day 1**
1. Merge `challenge/universe-config.json` (adds `interplanetary_links[]`) into app config loader
2. Update 3D void links to use explicit link list + capacities
3. Env setup: `CHIMERA_API_URL`, `CHIMERA_TEAM_KEY` in `.env.local.example`
4. Smoke test: app still runs with Phase 1 features intact

**Day 2**
5. **Chimera panel** in sidebar: live `/state` poll (~2–3s), per-link load_ratio, status, trust/congestion/risk chips
6. **CoPilot trace** panel: `chosen_path`, `link_evaluations`, `explanation`
7. 3D link coloring: green = ok, amber = congested, red = saturated/spoofed
8. NL input box: e.g. "Send Caelum to Aegis: Hello world" alongside existing dropdowns

**Day 3**
9. Phase 2 demo script for evaluation trials (see below)
10. README: architecture diagram, model summary, API docs, env vars
11. End-to-end test: NL input → agent → 3D route + JSON report
12. Deploy to Vercel with env vars for live day

**Live day**
13. Run demo, screen share, handle UI during chaos test
14. Support Decision Audit with Person 1

### Success criteria
- Judges can see Chimera footprint, model findings, and live adaptation in the UI
- README explains the full stack without reading code

---

## Shared contracts (agree Day 1 morning)

| Interface | Owner | Consumers |
|-----------|-------|-----------|
| `LinkLiveState` from `/state` | Person 2 | Person 1 (model inputs), Person 3 (UI) |
| `ModelScores` per link | Person 1 | Person 2 (agent tools) |
| `CopilotReport` JSON schema | Person 2 | Person 3 (UI), judges |
| `interplanetary_links` in config | Person 3 | Person 2 (graph), Person 1 (link list) |

### Git branch strategy
- `main` — stable Phase 1
- `phase2` — integration branch
- Person 1: `phase2/models`
- Person 2: `phase2/copilot`
- Person 3: `phase2/ui`
- Daily merge to `phase2` at end of each day

---

## Day-by-day schedule

| Day | All team | Person 1 | Person 2 | Person 3 |
|-----|----------|----------|----------|----------|
| **Day 1** | 30 min kickoff: agree interfaces + `link_id` convention | EDA + model contracts + first congestion prototype | Chimera client + NL parser + baseline route wire-up | Config merge + env setup + link list in 3D |
| **Day 2** | 15 min sync: model outputs plugged into agent? | Finish 3 models + `findings.md` draft | Agent loop + true-cost router + schema output | Chimera panel + live poll UI |
| **Day 3** | 30 min dry-run of evaluation trials | Model tuning + explainability notes | Chaos reroute + tests + edge cases | Demo script + README + deploy |
| **Live** | Stay on call together | Decision Audit lead | Operate agent + API | Drive demo UI |

---

## Evaluation trials (who leads)

| Trial | Lead | Backup |
|-------|------|--------|
| System init — extended config + historical footprint | Person 3 | Person 2 |
| Intelligence walkthrough — spoofed links, congestion, entropy | Person 1 | Person 2 |
| Live chaos — sever busiest link, reroute live | Person 2 | Person 3 |
| Unseen vector — graceful uncertainty flag | Person 2 | Person 1 |
| Decision Audit — explain one `link_evaluations` row | Person 1 | Person 2 |

### Performance metrics (judges)

| Criterion | What it measures |
|-----------|------------------|
| Congestion accuracy | Chimera throttling penalties on unrecorded windows |
| Trust accuracy | Spoofed links isolated without breaking noisy honest links |
| Live resilience | Real-time adaptation during chaos, zero packet loss/crash |
| Live generalization | Rational behavior on novel undocumented events |
| Explanation quality | Verbal clarity under cross-examination |
| Code & docs | Readable code, dynamic config, README, correct output format |

---

## Sync points (Phase 2)

| Time | Sync |
|------|------|
| Day 1 AM | All agree on model I/O contracts, `link_id` format, env vars |
| Day 1 EOD | Person 2 can call `/state`; Person 1 has congestion stub; Person 3 shows 12 links in 3D |
| Day 2 EOD | End-to-end: NL request → agent → unified JSON (mock or scrambled live data) |
| Day 3 EOD | Full dry-run of all 5 evaluation trials |
| Live day | Person 2 on API/agent, Person 3 on UI, Person 1 on audit answers |

---

## Rules of engagement

1. **Do not train on `/state` during Days 1–3** — values are scrambled; use CSVs only
2. **Do not replace Phase 1 physics** — baseline calculation stays; CoPilot adjusts on top
3. **Do not share `X-Team-Key`**
4. **Do not treat `saturated` as zero latency** — treat as unavailable for that tick
5. **Do not omit or alter unified report fields** — instant disqualification
6. Poll `/state` at a reasonable interval; faster polling does not yield newer ticks

---

## First 2 hours (kickoff)

1. **All:** Read `phase2.md` + `challenge/DATASETS.md` together (30 min)
2. **Person 1:** EDA — plot `load_ratio` vs latency, telemetry delta per link
3. **Person 2:** `curl https://chimera.launch26.space/` and stub `client.ts`
4. **Person 3:** Point app at `challenge/universe-config.json`, verify 12 links render

---

## Shared rule

> Person 1's models score links. Person 2's agent calls them and owns the unified report. Person 3 surfaces everything in the UI and docs. **Agree contracts on Day 1 morning; no one blocks after that.**
