# Phase 2 Demo Script — Evaluation Trials

Use this script for dry-runs and live Council evaluation. **Lead roles** from [team_plan.md](../team_plan.md).

**Prerequisites**

- `npm run dev` (local) or Vercel deploy with `CHIMERA_TEAM_KEY` set
- `.env.local` contains `CHIMERA_API_URL` and team key
- Screen share: 3D view + sidebar visible

---

## Trial 1 — System initialization (Person 3 lead)

**Goal:** Extended config + Chimera footprint visible.

1. Open the app — universe loads from `challenge/universe-config.json` (12 links).
2. Point to **Chimera grid** panel — links polling live `/state` every ~2.5s, tick increments.
3. Point to 3D void links: **green** = ok, **amber** = congested, **red** = saturated/spoofed risk.
4. Mention Phase 1 physics (fiber, towers, atmosphere, void) unchanged underneath.

**Talking point:** “We ingest historical CSVs for model training; live `/state` only drives routing at demo time.”

---

## Trial 2 — Intelligence walkthrough (Person 1 lead)

**Goal:** Explain Chimera tactics and spoofed links.

1. Open `src/lib/chimera/models/findings.md`.
2. **Congestion:** saturation at ~0.91 load_ratio; penalty curve above 35% load.
3. **Trust:** flag **Aegis-Elysium** and **Boreas-Fenix** as systematic telemetry liars.
4. **Targeting:** jam risk rises above ~8.7% traffic share; route entropy penalty.
5. Show Chimera panel live scores matching those findings.

---

## Trial 3 — CoPilot multi-hop (Person 2 + Person 3)

**Goal:** NL request → unified report + 3D route.

1. In sidebar, enter: `Send Caelum to Aegis: Hello world`
2. Click **CoPilot send**.
3. Show **CoPilot report**: `chosen_path`, `link_evaluations[]`, `explanation`.
4. Expand **Sequential agent log** — one tool step per node (congestion, trust, targeting verdicts), proving the per-hop agent loop required by the brief.
5. Point to **Route entropy** bar — diversification metric across recent sends.
6. Show 3D route animation on detour path (if baseline blocked).
7. Expand **Packet trace** — encoding changes per hop on CoPilot path.

**API equivalent:**

```bash
curl -X POST http://localhost:3000/api/copilot \
  -H "Content-Type: application/json" \
  -d '{"text":"Send Caelum to Aegis: Hello world"}'
```

---

## Trial 4 — Live chaos test (Person 2 lead, Person 3 on UI)

**Goal:** Sever the busiest link **while a packet is in flight** — the packet pivots mid-route with zero loss.

1. Send a CoPilot message; watch the packet animate along `chosen_path`.
2. While it's flying, sever an upcoming link on its path (**Sever void link** in UI).
3. The packet **does not drop**: it pivots at the next node, the remaining path is
   re-solved live (Lmax respected), and an amber notice explains the pivot in the transit bar.
4. Send another CoPilot message on the same pair — the unified report now excludes
   the severed link and the explanation says why.
5. Confirm no crash, valid unified JSON, saturated links still avoided.

**Talking point:** "Traveled hops are preserved — we reroute only the remaining
path from the packet's current position, so nothing is retransmitted."

---

## Trial 5 — Unseen vector (Person 2 lead)

**Goal:** Graceful behavior on novel conditions.

1. The anomaly guard (`src/lib/chimera/anomaly.ts`) validates every live link against
   the trained input domain: `load_ratio` in [0, 1], non-negative latency, known
   `link_id`s, recognized statuses, no missing telemetry.
2. Anomalous links are **excluded from routing** (never silently mis-scored) and the
   report shows an amber "Uncertainty flagged" banner listing each reason.
3. Agent picks safest known path or returns clear error — never treats saturated as latency 0.

---

## Trial 6 — Decision Audit (Person 1 lead)

**Goal:** Explain one `link_evaluations` row without reading code.

1. Judge picks a row from your last CoPilot report.
2. **Click that row in the UI** — the Decision Audit panel opens with the full
   scoring rationale: congestion formula with live numbers plugged in, trust
   prior + live lie gap, targeting logistic, and the combined-cost arithmetic.
3. Person 1 narrates from the panel:
   - Congestion: load_ratio → penalty formula
   - Trust: learned prior + live lie gap vs self-reported
   - Targeting: traffic_share logistic + our route-history boost
   - Combined cost: physics + penalties + trust/risk weights

`evaluateLinkWithExplanation()` from `@/lib/chimera/models` powers the panel.

---

## Quick checklist

| Check | Pass? |
|-------|-------|
| Chimera panel polls live | |
| 3D link colors reflect health | |
| NL CoPilot send works | |
| Unified report schema complete | |
| Sequential agent log shows per-hop tool steps | |
| Decision Audit opens on row click | |
| Mid-flight sever pivots packet without dropping | |
| Anomalous telemetry shows uncertainty banner | |
| Route entropy bar updates across sends | |
| Saturated links never selected | |
| Phase 1 send still works | |
| Kill planet / sever link still works | |

---

## Tests before demo

```bash
npm run test:models
npm run test:copilot
npm run build
```
