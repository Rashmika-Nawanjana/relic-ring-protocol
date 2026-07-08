"""Detailed accuracy report for Person 1 models on held-out ticks 400-499."""
from __future__ import annotations

import csv
import math
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from train_models import (  # noqa: E402
    HOLD_OUT_FROM_TICK,
    evaluate_holdout,
    load_csv,
    main as train_main,
)

PARAMS_PATH = ROOT / "src" / "lib" / "chimera" / "models" / "params.ts"


def load_params() -> dict:
    text = PARAMS_PATH.read_text(encoding="utf-8")
    start = text.index("{")
    end = text.rindex("}") + 1
    import json

    return json.loads(text[start:end])


def main() -> None:
    if not PARAMS_PATH.exists():
        train_main()
    params = load_params()
    metrics = evaluate_holdout(params)

    print("=== PERSON 1 MODEL ACCURACY (ticks 400-499) ===\n")
    print("CONGESTION (hybrid per-link power-law + bins)")
    print(f"  Pearson r:     {metrics['congestion_pearson']:.4f}")
    print(f"  MAPE:          {metrics['congestion_mape']*100:.1f}%")
    print()
    print("TRUST (per-link profiles + live lie detection)")
    print(f"  Spoof avg:     {metrics['trust_spoof_avg']:.4f}")
    print(f"  Honest avg:    {metrics['trust_honest_avg']:.4f}")
    print(f"  False flags:   {metrics['trust_honest_false_flag']*100:.1f}%")
    print()
    print("TARGETING (calibrated traffic_share bins)")
    print(f"  AUC:           {metrics['targeting_auc']:.4f}")
    print()
    print("Spoofed links:", params["spoofed_links"])


if __name__ == "__main__":
    main()
