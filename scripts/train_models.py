"""Offline training for Person 1 models. Writes src/lib/chimera/models/params.ts."""
from __future__ import annotations

import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHALLENGE = ROOT / "challenge"
OUT = ROOT / "src" / "lib" / "chimera" / "models" / "params.ts"

HOLD_OUT_FROM_TICK = 400


def load_csv(name: str) -> list[dict[str, str]]:
    with open(CHALLENGE / name, newline="") as f:
        return list(csv.DictReader(f))


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def main() -> None:
    traffic = load_csv("link_traffic_history.csv")
    telemetry = load_csv("link_telemetry.csv")
    incidents = load_csv("link_incident_history.csv")

    links = sorted({r["link_id"] for r in traffic})
    train_traffic = [r for r in traffic if int(r["tick"]) < HOLD_OUT_FROM_TICK]
    train_telemetry = [r for r in telemetry if int(r["tick"]) < HOLD_OUT_FROM_TICK]
    train_incidents = [r for r in incidents if int(r["tick"]) < HOLD_OUT_FROM_TICK]

    # --- Saturation threshold ---
    sat_ratios = [float(r["load_ratio"]) for r in train_traffic if r["status"] == "saturated"]
    saturation_threshold = min(sat_ratios) if sat_ratios else 0.90

    # --- Per-link physics baseline (p10 observed latency at low load) ---
    baselines: dict[str, float] = {}
    for lid in links:
        lows = [
            float(r["observed_latency_ms"])
            for r in train_traffic
            if r["link_id"] == lid
            and r["observed_latency_ms"]
            and float(r["load_ratio"]) < 0.30
        ]
        baselines[lid] = sorted(lows)[max(0, len(lows) // 10)] if lows else 50_000.0

    # --- Congestion curve: penalty = scale * ((load - onset) / span) ^ exponent ---
    onset = 0.35
    span = saturation_threshold - onset
    penalties: list[tuple[float, float]] = []
    for r in train_traffic:
        if not r["observed_latency_ms"] or r["status"] == "saturated":
            continue
        lr = float(r["load_ratio"])
        if lr < onset:
            continue
        pen = float(r["observed_latency_ms"]) - baselines[r["link_id"]]
        if pen >= 0:
            t = (lr - onset) / span
            penalties.append((t, pen))

    # Fit exponent via log-log on binned medians
    bins: dict[int, list[float]] = defaultdict(list)
    for t, pen in penalties:
        b = min(9, int(t * 10))
        bins[b].append(pen)

    ref_t, ref_pen = 0.5, 200_000.0
    for b in sorted(bins):
        med = statistics.median(bins[b])
        t = (b + 0.5) / 10
        if med > ref_pen:
            ref_t, ref_pen = t, med
            break

    exponent = math.log(ref_pen + 1) / math.log(ref_t + 0.01) if ref_t > 0 else 2.2
    exponent = clamp(exponent, 1.5, 4.0)
    scale = ref_pen / ((ref_t + 0.01) ** exponent)

    # --- Trust: per-link under-report rate + median relative delta ---
    link_priors: dict[str, float] = {}
    spoofed: list[str] = []
    for lid in links:
        deltas: list[float] = []
        under = 0
        total = 0
        for r in train_telemetry:
            if r["link_id"] != lid:
                continue
            if not r["self_reported_latency_ms"] or not r["measured_latency_ms"]:
                continue
            self_r = float(r["self_reported_latency_ms"])
            meas = float(r["measured_latency_ms"])
            deltas.append(abs(self_r - meas) / max(meas, 1))
            total += 1
            if self_r < meas * 0.80:
                under += 1
        median_delta = statistics.median(deltas) if deltas else 0.03
        under_rate = under / total if total else 0
        prior = 0.95 - under_rate * 0.75 - max(0, median_delta - 0.05) * 2
        prior = clamp(prior, 0.05, 0.99)
        link_priors[lid] = round(prior, 4)
        if under_rate >= 0.25:
            spoofed.append(lid)

    # --- Targeting: logistic on traffic_share ---
    jam_shares = [
        float(r["traffic_share"])
        for r in train_incidents
        if r["traffic_share"] and r["jammed_flag"] == "True"
    ]
    safe_shares = [
        float(r["traffic_share"])
        for r in train_incidents
        if r["traffic_share"] and r["jammed_flag"] == "False"
    ]
    jam_onset = statistics.median(jam_shares) if jam_shares else 0.10
    jam_onset = clamp(jam_onset * 0.85, 0.06, 0.14)
    steepness = 30.0

    params = {
        "saturation_load_ratio": round(saturation_threshold, 4),
        "congestion_onset_ratio": onset,
        "congestion_exponent": round(exponent, 3),
        "congestion_scale_ms": round(scale, 1),
        "link_baselines_ms": {k: round(v, 2) for k, v in baselines.items()},
        "link_trust_priors": link_priors,
        "spoofed_links": sorted(spoofed),
        "honest_noise_p95": 0.05,
        "live_lie_gap_threshold": 0.15,
        "targeting_jam_onset_share": round(jam_onset, 4),
        "targeting_steepness": steepness,
        "hold_out_from_tick": HOLD_OUT_FROM_TICK,
    }

    ts = (
        "/** Auto-generated by scripts/train_models.py — do not edit by hand. */\n"
        f"export const TRAINED_PARAMS = {json.dumps(params, indent=2)} as const;\n\n"
        "export type TrainedParams = typeof TRAINED_PARAMS;\n"
    )
    OUT.write_text(ts, encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Spoofed links: {spoofed}")
    print(f"Saturation threshold: {saturation_threshold:.4f}")
    print(f"Congestion: scale={scale:.0f} exp={exponent:.2f}")


if __name__ == "__main__":
    main()
