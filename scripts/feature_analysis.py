"""Feature analysis for model improvements."""
import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOLD = 400

def load(name):
    with open(ROOT / "challenge" / name, newline="") as f:
        return list(csv.DictReader(f))

traffic = load("link_traffic_history.csv")
telemetry = load("link_telemetry.csv")
incidents = load("link_incident_history.csv")

# Per-link congestion fit quality
links = sorted({r["link_id"] for r in traffic})
train = [r for r in traffic if int(r["tick"]) < HOLD]

for lid in links:
    rows = [r for r in train if r["link_id"]==lid and r["observed_latency_ms"] and r["status"]!="saturated"]
    lows = [float(r["observed_latency_ms"]) for r in rows if float(r["load_ratio"]) < 0.25]
    baseline = sorted(lows)[len(lows)//10] if lows else 0
    pairs = [(float(r["load_ratio"]), float(r["observed_latency_ms"])-baseline) for r in rows]
    pairs = [(lr,p) for lr,p in pairs if p>=0 and lr>=0.35]
    if len(pairs)<10:
        continue
    # fit exponent per link
    best_exp, best_err = 1.5, 1e18
    for exp in [x/10 for x in range(10, 45)]:
        errs = []
        for lr, pen in pairs:
            t = (lr - 0.35) / (0.9136 - 0.35)
            pred = 500000 * (max(0,t)**exp)
            errs.append((pred-pen)**2)
        err = statistics.mean(errs)
        if err < best_err:
            best_err, best_exp = err, exp
    print(f"{lid}: baseline={baseline:.0f} best_exp={best_exp:.1f} rmse={math.sqrt(best_err):.0f} n={len(pairs)}")

# Targeting features
traffic_map = {(r["link_id"], r["tick"]): r for r in traffic}
print("\n--- Targeting feature correlations ---")
for feat_name, getter in [
    ("traffic_share", lambda r: float(r["traffic_share"])),
    ("load_ratio", lambda r: float(traffic_map.get((r["link_id"], r["tick"]), {}).get("load_ratio") or 0)),
]:
    jam = [getter(r) for r in incidents if int(r["tick"])<HOLD and r["traffic_share"] and r["jammed_flag"]=="True" and traffic_map.get((r["link_id"], r["tick"]))]
    safe = [getter(r) for r in incidents if int(r["tick"])<HOLD and r["traffic_share"] and r["jammed_flag"]=="False" and traffic_map.get((r["link_id"], r["tick"]))]
    print(f"{feat_name}: jam_mean={statistics.mean(jam):.4f} safe_mean={statistics.mean(safe):.4f}")

# Per-link jam rate
print("\nPer-link jam rate:")
for lid in links:
    rows = [r for r in incidents if r["link_id"]==lid and r["traffic_share"] and int(r["tick"])<HOLD]
    rate = sum(1 for r in rows if r["jammed_flag"]=="True")/len(rows)
    print(f"  {lid}: {rate:.4f}")

# Trust: per-link p95 relative under-report
print("\nTrust p95 under-report gap (expected-self)/expected using measured as truth:")
for lid in links:
    gaps = []
    for r in telemetry:
        if r["link_id"]!=lid or int(r["tick"])>=HOLD: continue
        if not r["self_reported_latency_ms"] or not r["measured_latency_ms"]: continue
        m, s = float(r["measured_latency_ms"]), float(r["self_reported_latency_ms"])
        gaps.append((m-s)/m)
    if gaps:
        gaps.sort()
        p95 = gaps[int(len(gaps)*0.95)]
        print(f"  {lid}: p95_gap={p95:.3f}")
