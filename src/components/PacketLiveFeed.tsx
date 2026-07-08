"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUniverse } from "@/context/UniverseContext";
import { buildPlanetTowerRoutes } from "@/lib/universe/packet-path";
import {
  packetLegAtProgress,
  type PacketLiveSnapshot,
} from "@/lib/universe/packet-live";

const IDLE: PacketLiveSnapshot = {
  phase: "idle",
  progress: 0,
  legIndex: 0,
  legProgress: 0,
  hopIndex: 0,
  planet: null,
  tower: null,
  nextPlanet: null,
  encoding: null,
  encodingBase: null,
};

const PHASE_LABEL: Record<PacketLiveSnapshot["phase"], string> = {
  idle: "Standby",
  fiber: "Fiber ring",
  void: "Void laser",
  tower: "Tower relay",
  delivered: "Delivered",
  held: "Held — waiting",
};

function estimatePathLength(routeLen: number) {
  return Math.max(routeLen * 12 * 0.08, 0.35);
}

export function PacketLiveFeed() {
  const {
    config,
    route,
    routeResult,
    isSending,
    packetTransmitKey,
    packetLegRef,
    packetResumeProgress,
    rerouteNotice,
    packetHeld,
    heldAtPlanet,
  } = useUniverse();
  const [live, setLive] = useState<PacketLiveSnapshot>(IDLE);
  const progressRef = useRef(0);

  const encodingsByPlanet = useMemo(() => {
    const map = new Map<string, { encoding: string; base: number }>();
    if (!routeResult?.ok) return map;
    for (const hop of routeResult.hops) {
      if (hop.encoding && hop.encoding_base != null) {
        map.set(hop.planet, { encoding: hop.encoding, base: hop.encoding_base });
      }
    }
    return map;
  }, [routeResult]);

  const towerRoutes = useMemo(() => {
    if (route.length < 2) return [];
    const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
    return buildPlanetTowerRoutes(
      route,
      nodeMap,
      config.universe_metadata.coordinate_scale_unit_km,
    );
  }, [route, config]);

  useEffect(() => {
    if (isSending) {
      setLive({ ...IDLE, phase: "idle" });
      return;
    }

    if (!routeResult?.ok || route.length < 2) {
      progressRef.current = 0;
      packetLegRef.current = 0;
      setLive(IDLE);
      return;
    }

    // Resume mid-path after a chaos reroute; 0 on a fresh transmit
    progressRef.current = packetResumeProgress;
    let raf = 0;
    let last = performance.now();
    const pathLen = estimatePathLength(route.length);

    const tick = (now: number) => {
      if (packetHeld) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }

      const delta = (now - last) / 1000;
      last = now;
      progressRef.current += delta * (0.45 / pathLen);
      if (progressRef.current >= 1) progressRef.current %= 1;

      const snapshot = packetLegAtProgress(
        progressRef.current,
        route,
        towerRoutes,
        encodingsByPlanet,
      );
      packetLegRef.current = snapshot.legIndex;
      setLive(snapshot);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    route,
    routeResult,
    isSending,
    packetTransmitKey,
    packetResumeProgress,
    towerRoutes,
    encodingsByPlanet,
    packetLegRef,
    packetHeld,
  ]);

  const hasRoute = routeResult?.ok && route.length >= 1;
  const statusLabel = isSending
    ? "Computing route"
    : packetHeld
      ? `Held at ${heldAtPlanet ?? "planet"} — retrying`
      : hasRoute
        ? PHASE_LABEL[live.phase]
        : "No active route";

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-white/6 bg-[rgba(8,8,10,0.88)] px-4 py-3 backdrop-blur-md"
      aria-live="polite"
      aria-label="Live packet status"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              packetHeld
                ? "animate-pulse bg-amber-400"
                : isSending
                  ? "animate-pulse bg-[var(--accent)]"
                  : hasRoute && live.phase !== "idle"
                    ? "animate-pulse bg-zinc-300"
                    : "bg-zinc-600"
            }`}
          />
          <span className="text-xs font-medium text-zinc-300">
            {statusLabel}
          </span>
        </div>

        {hasRoute && live.planet && (
          <span className="text-xs text-zinc-500">
            {live.phase === "void" && live.nextPlanet
              ? `${live.planet} → ${live.nextPlanet}`
              : `${live.planet}${live.tower ? ` · ${live.tower}` : ""}`}
          </span>
        )}

        {hasRoute && routeResult.ok && (
          <span className="ml-auto text-[11px] tabular-nums text-zinc-600">
            {routeResult.total_latency_ms.toFixed(1)} ms
          </span>
        )}
      </div>

      {rerouteNotice && (
        <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
          {rerouteNotice}
        </p>
      )}

      {hasRoute && (
        <>
          <div className="mt-2 flex flex-wrap gap-1">
            {route.map((id, i) => (
              <span key={`${id}-${i}`} className="flex items-center gap-1 text-[11px]">
                {i > 0 && <span className="text-zinc-700">→</span>}
                <span
                  className={
                    live.planet === id ||
                    (live.phase === "void" &&
                      (live.planet === id || live.nextPlanet === id))
                      ? "font-medium text-zinc-200"
                      : "text-zinc-500"
                  }
                >
                  {id}
                </span>
              </span>
            ))}
          </div>

          <div className="mt-2 flex gap-1">
            {route.slice(0, -1).map((from, i) => {
              const to = route[i + 1];
              const isPast = i < live.legIndex;
              const isActive = i === live.legIndex;
              const fill = isPast ? 100 : isActive ? live.legProgress * 100 : 0;

              return (
                <div key={`leg-${i}-${from}-${to}`} className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="h-1 overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full bg-zinc-300/80"
                      style={{ width: `${fill}%` }}
                    />
                  </div>
                  <span
                    className={`truncate text-center text-[9px] ${
                      isActive ? "text-zinc-400" : "text-zinc-700"
                    }`}
                  >
                    {from}→{to}
                  </span>
                </div>
              );
            })}
          </div>

          {live.encoding && (
            <p className="mt-2 truncate font-mono text-[10px] text-zinc-600">
              base {live.encodingBase} · {live.encoding}
            </p>
          )}
        </>
      )}

      {!hasRoute && !isSending && (
        <p className="mt-1 text-[11px] text-zinc-600">
          Send a packet to see live transit along the route.
        </p>
      )}
    </div>
  );
}
