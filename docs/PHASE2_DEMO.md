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
4. Show 3D route animation on detour path (if baseline blocked).
5. Expand **Packet trace** — encoding changes per hop on CoPilot path.

**API equivalent:**

```bash
curl -X POST http://localhost:3000/api/copilot \
  -H "Content-Type: application/json" \
  -d '{"text":"Send Caelum to Aegis: Hello world"}'
```

---

## Trial 4 — Live chaos test (Person 2 lead, Person 3 on UI)

**Goal:** Sever busiest link; next message reroutes without crash.

1. Note current CoPilot `chosen_path` and heaviest `link_evaluations` row.
2. Council severs that link (or use **Sever void link** in UI for dry-run).
3. Send another CoPilot message same origin/destination.
4. Show new path avoids severed link; explanation mentions exclusion/detour.
5. Confirm no crash, valid unified JSON, Lmax respected.

---

## Trial 5 — Unseen vector (Person 2 lead)

**Goal:** Graceful behavior on novel conditions.

1. If Council injects unknown telemetry pattern, show `explanation` flags uncertainty.
2. Agent picks safest known path or returns clear error — never treats saturated as latency 0.

---

## Trial 6 — Decision Audit (Person 1 lead)

**Goal:** Explain one `link_evaluations` row without reading code.

1. Judge picks a row from your last CoPilot report.
2. Person 1 walks through:
   - Congestion: load_ratio → penalty formula
   - Trust: prior + live lie gap vs self-reported
   - Targeting: traffic_share logistic
   - Combined cost: physics + penalties + trust/risk weights

Use `evaluateLinkWithExplanation()` from `@/lib/chimera/models` if needed for rehearsal.

---

## Quick checklist

| Check | Pass? |
|-------|-------|
| Chimera panel polls live | |
| 3D link colors reflect health | |
| NL CoPilot send works | |
| Unified report schema complete | |
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
