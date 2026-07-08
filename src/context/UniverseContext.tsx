"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { loadUniverseConfig } from "@/lib/universe/load";
import { buildScenePlanets } from "@/lib/universe/geometry";
import { findRoute, buildVoidEdges, traceFixedRoute, voidEdgeKey } from "@/lib/universe/router";
import type { CopilotReport } from "@/lib/copilot/schema";
import type { AgentLogStep } from "@/lib/copilot/agent";
import type { LiveAnomaly } from "@/lib/chimera/anomaly";
import type { LinkEvaluationExplanation } from "@/lib/chimera/models/explain";
import type { LinkHealthStatus } from "@/lib/chimera/panel-data";
import type {
  RouteResult,
  ScenePlanet,
  UniverseConfig,
} from "@/lib/universe/types";

export type SceneSettings = {
  sunIntensity: number;
  orbitSpeed: number;
  rotationSpeed: number;
  showOrbits: boolean;
  showTowers: boolean;
  showTowerPaths: boolean;
};

export type CopilotSendInput = {
  text?: string;
  origin?: string;
  destination?: string;
  message?: string;
};

export type CopilotMeta = {
  agent_log: AgentLogStep[];
  anomalies: LiveAnomaly[];
  audit: LinkEvaluationExplanation[];
};

type UniverseContextValue = {
  config: UniverseConfig;
  planets: ScenePlanet[];
  edges: ReturnType<typeof buildVoidEdges>;
  killed: Set<string>;
  killedLinks: Set<string>;
  selectedId: string | null;
  hoveredId: string | null;
  route: string[];
  routeResult: RouteResult | null;
  isSending: boolean;
  packetTransmitKey: number;
  sceneSettings: SceneSettings;
  copilotReport: CopilotReport | null;
  copilotMeta: CopilotMeta | null;
  copilotError: string | null;
  isCopilotSending: boolean;
  linkHealthMap: Map<string, LinkHealthStatus>;
  chimeraTick: number | null;
  trafficHistory: string[];
  /** Written by PacketLiveFeed each frame — current leg index of the in-flight packet. */
  packetLegRef: MutableRefObject<number>;
  /** Shared animation progress (0–1), driven by PacketLiveFeed, read by VoidLinks 3D. */
  packetProgressRef: MutableRefObject<number>;
  /** Fraction (0–1) the packet animation should resume from after a mid-flight reroute. */
  packetResumeProgress: number;
  /** Chaos-test notice shown when a severed link forced a live pivot. */
  rerouteNotice: string | null;
  /** True when the packet is held at a planet waiting for a safe hop. */
  packetHeld: boolean;
  /** Planet where the packet is held, if any. */
  heldAtPlanet: string | null;
  setSceneSettings: (patch: Partial<SceneSettings>) => void;
  setLinkHealthMap: (map: Map<string, LinkHealthStatus>) => void;
  setChimeraTick: (tick: number) => void;
  resetView: () => void;
  resetViewTick: number;
  setSelectedId: (id: string | null) => void;
  setHoveredId: (id: string | null) => void;
  toggleKill: (id: string) => void;
  toggleKillLink: (key: string) => void;
  sendPacket: (origin: string, destination: string, message: string) => Promise<void>;
  sendCopilot: (input: CopilotSendInput) => Promise<void>;
};

const UniverseContext = createContext<UniverseContextValue | null>(null);

const DEFAULT_SCENE: SceneSettings = {
  sunIntensity: 1.9,
  orbitSpeed: 1,
  rotationSpeed: 1,
  showOrbits: true,
  showTowers: true,
  showTowerPaths: true,
};

export function UniverseProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => loadUniverseConfig(), []);
  const planets = useMemo(() => buildScenePlanets(config), [config]);
  const [killed, setKilled] = useState<Set<string>>(new Set());
  const [killedLinks, setKilledLinks] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [route, setRoute] = useState<string[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [packetTransmitKey, setPacketTransmitKey] = useState(0);
  const [sceneSettings, setSceneSettingsState] = useState<SceneSettings>(DEFAULT_SCENE);
  const [resetViewTick, setResetViewTick] = useState(0);
  const [copilotReport, setCopilotReport] = useState<CopilotReport | null>(null);
  const [copilotMeta, setCopilotMeta] = useState<CopilotMeta | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [isCopilotSending, setIsCopilotSending] = useState(false);
  const [linkHealthMap, setLinkHealthMap] = useState<Map<string, LinkHealthStatus>>(
    new Map(),
  );
  const [chimeraTick, setChimeraTick] = useState<number | null>(null);
  const [trafficHistory, setTrafficHistory] = useState<string[]>([]);
  const [lastMessage, setLastMessage] = useState("Hello world");
  const [packetResumeProgress, setPacketResumeProgress] = useState(0);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);
  const [packetHeld, setPacketHeld] = useState(false);
  const [heldAtPlanet, setHeldAtPlanet] = useState<string | null>(null);
  const hopCheckInFlight = useRef(false);
  const packetLegRef = useRef(0);
  const packetProgressRef = useRef(0);

  const edges = useMemo(
    () => buildVoidEdges(config, killed, killedLinks),
    [config, killed, killedLinks],
  );

  const setSceneSettings = useCallback((patch: Partial<SceneSettings>) => {
    setSceneSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetView = useCallback(() => {
    setSelectedId(null);
    setResetViewTick((n) => n + 1);
  }, []);

  const clearRoute = useCallback(() => {
    setRoute([]);
    setRouteResult(null);
    setPacketResumeProgress(0);
    setRerouteNotice(null);
    setPacketHeld(false);
    setHeldAtPlanet(null);
  }, []);

  const toggleKill = useCallback(
    (id: string) => {
      setKilled((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      clearRoute();
      setCopilotReport(null);
      setCopilotMeta(null);
    },
    [clearRoute],
  );

  /**
   * Live chaos handler: if the severed link sits on the active route
   * (current or upcoming leg), pivot the remaining path from the packet's
   * position instead of dropping it. Traveled hops are preserved.
   */
  const toggleKillLink = useCallback(
    (key: string) => {
      const severing = !killedLinks.has(key);
      const nextKilledLinks = new Set(killedLinks);
      if (severing) nextKilledLinks.add(key);
      else nextKilledLinks.delete(key);
      setKilledLinks(nextKilledLinks);

      if (!severing) {
        // Restoring a link never invalidates the active route
        return;
      }

      const onRouteAt = route.findIndex(
        (p, i) =>
          i < route.length - 1 && voidEdgeKey(p, route[i + 1]!) === key,
      );

      if (onRouteAt < 0 || route.length < 2 || !routeResult?.ok) {
        return; // severed link not on the active route — nothing in flight to save
      }

      const legs = route.length - 1;
      const currentLeg = Math.max(0, Math.min(packetLegRef.current, legs - 1));

      if (onRouteAt < currentLeg) {
        return; // packet already crossed that link — no pivot needed
      }

      // Pivot at the node the packet will reach next (or the node it is
      // departing from, when the severed link is the leg in progress).
      const pivotIdx = onRouteAt === currentLeg ? currentLeg : currentLeg + 1;
      const pivot = route[pivotIdx]!;
      const destination = route[route.length - 1]!;

      const sub =
        pivot === destination
          ? null
          : findRoute(config, pivot, destination, killed, lastMessage, nextKilledLinks);

      if (!sub || !sub.ok) {
        setRerouteNotice(
          `Chimera severed ${key} — no surviving route from ${pivot} within Lmax. Packet held at ${pivot}.`,
        );
        clearRoute();
        setCopilotReport(null);
        setCopilotMeta(null);
        return;
      }

      const newRoute = [...route.slice(0, pivotIdx), ...sub.route];
      const trace = traceFixedRoute(config, newRoute, lastMessage, killed, nextKilledLinks);
      if (!trace.ok) {
        clearRoute();
        setCopilotReport(null);
        setCopilotMeta(null);
        return;
      }

      setRoute(newRoute);
      setRouteResult(trace);
      setPacketResumeProgress(pivotIdx / (newRoute.length - 1));
      setRerouteNotice(
        `Chimera severed ${key} mid-flight — pivoted at ${pivot}, packet re-routed via ${sub.route
          .slice(1)
          .join(" → ")} with zero loss.`,
      );
    },
    [config, killed, killedLinks, route, routeResult, lastMessage, clearRoute],
  );

  // ── Live Chimera gate ────────────────────────────────────────────
  // Every time ChimeraPanel polls a new tick, scan ALL links on the
  // active route.  If any are "danger", ask CoPilot for a fresh
  // origin→destination path.  The packet animation keeps looping and
  // switches to the new path immediately — judges see the route update
  // live as Chimera conditions change.
  useEffect(() => {
    if (route.length < 2 || !routeResult?.ok) return;
    if (hopCheckInFlight.current) return;

    const origin = route[0]!;
    const destination = route[route.length - 1]!;

    // ── Retry: packet is held — see if a safe path opened ──
    if (packetHeld) {
      hopCheckInFlight.current = true;

      fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: heldAtPlanet ?? origin,
          destination,
          message: lastMessage,
          killed: [...killed],
          killed_links: [...killedLinks],
          traffic_history: trafficHistory,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.ok) return;

          const newRoute: string[] = data.chosen_path;
          const trace = traceFixedRoute(config, newRoute, lastMessage, killed, killedLinks);
          if (!trace.ok) return;

          setRoute(newRoute);
          setRouteResult(trace);
          setPacketResumeProgress(0);
          setPacketTransmitKey((k) => k + 1);
          setPacketHeld(false);
          setHeldAtPlanet(null);
          setRerouteNotice(
            `Path cleared — resumed via ${newRoute.join(" → ")}.`,
          );
        })
        .catch(() => {})
        .finally(() => {
          hopCheckInFlight.current = false;
        });
      return;
    }

    // ── Scan: any link on the route in "danger"? ──
    let dangerLinkId: string | null = null;
    for (let i = 0; i < route.length - 1; i++) {
      const id = [route[i]!, route[i + 1]!].sort().join("-");
      if (linkHealthMap.get(id) === "danger") {
        dangerLinkId = id;
        break;
      }
    }
    if (!dangerLinkId) return;

    // ── Reroute: full origin → destination via CoPilot ──
    hopCheckInFlight.current = true;

    fetch("/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        message: lastMessage,
        killed: [...killed],
        killed_links: [...killedLinks],
        traffic_history: trafficHistory,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setPacketHeld(true);
          setHeldAtPlanet(origin);
          setRerouteNotice(
            `Chimera blocked ${dangerLinkId} — no safe route. Packet held, retrying…`,
          );
          return;
        }

        const newRoute: string[] = data.chosen_path;

        // Skip if CoPilot picked the same path (avoid animation restart)
        if (
          newRoute.length === route.length &&
          newRoute.every((p, i) => p === route[i])
        ) {
          return;
        }

        const trace = traceFixedRoute(config, newRoute, lastMessage, killed, killedLinks);
        if (!trace.ok) {
          setPacketHeld(true);
          setHeldAtPlanet(origin);
          setRerouteNotice(
            `Chimera blocked ${dangerLinkId} — reroute trace failed, holding.`,
          );
          return;
        }

        setRoute(newRoute);
        setRouteResult(trace);
        setPacketResumeProgress(0);
        setPacketTransmitKey((k) => k + 1);
        setCopilotReport({
          origin_id: origin,
          destination_id: destination,
          chosen_path: newRoute,
          link_evaluations: data.link_evaluations ?? [],
          final_latency_estimate_ms: data.final_latency_estimate_ms ?? 0,
          explanation: data.explanation ?? "",
        });
        setRerouteNotice(
          `Chimera update: ${dangerLinkId} unsafe → rerouted via ${newRoute.join(" → ")}.`,
        );
      })
      .catch(() => {})
      .finally(() => {
        hopCheckInFlight.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chimeraTick, linkHealthMap]);

  const sendPacket = useCallback(
    async (origin: string, destination: string, message: string) => {
      setIsSending(true);
      setCopilotReport(null);
      setCopilotMeta(null);
      setCopilotError(null);
      setRerouteNotice(null);
      setPacketResumeProgress(0);
      setPacketHeld(false);
      setHeldAtPlanet(null);
      setLastMessage(message);
      await new Promise((r) => setTimeout(r, 400));
      const result = findRoute(
        config,
        origin,
        destination,
        killed,
        message,
        killedLinks,
      );
      setRouteResult(result);
      setRoute(result.ok ? result.route : []);
      if (result.ok) setPacketTransmitKey((k) => k + 1);
      setIsSending(false);
    },
    [config, killed, killedLinks],
  );

  const sendCopilot = useCallback(
    async (input: CopilotSendInput) => {
      setIsCopilotSending(true);
      setCopilotError(null);
      setRerouteNotice(null);
      setPacketResumeProgress(0);
      setPacketHeld(false);
      setHeldAtPlanet(null);
      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            killed: [...killed],
            killed_links: [...killedLinks],
            traffic_history: trafficHistory,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "CoPilot routing failed");
        }

        const report: CopilotReport = {
          origin_id: data.origin_id,
          destination_id: data.destination_id,
          chosen_path: data.chosen_path,
          link_evaluations: data.link_evaluations,
          final_latency_estimate_ms: data.final_latency_estimate_ms,
          explanation: data.explanation,
        };

        setCopilotReport(report);
        setCopilotMeta({
          agent_log: data.agent_log ?? [],
          anomalies: data.anomalies ?? [],
          audit: data.audit ?? [],
        });
        setRoute(report.chosen_path);

        const message =
          input.message ??
          (input.text?.match(/:\s*(.+)$/)?.[1]?.trim() || "Hello world");
        setLastMessage(message);

        const trace = traceFixedRoute(
          config,
          report.chosen_path,
          message,
          killed,
          killedLinks,
        );
        setRouteResult(trace);
        if (trace.ok) setPacketTransmitKey((k) => k + 1);

        setTrafficHistory((prev) => [
          ...prev,
          ...report.link_evaluations.map((e) => e.link_id),
        ].slice(-24));
      } catch (e) {
        setCopilotError(e instanceof Error ? e.message : "CoPilot failed");
        setCopilotReport(null);
        setCopilotMeta(null);
      } finally {
        setIsCopilotSending(false);
      }
    },
    [config, killed, killedLinks, trafficHistory],
  );

  return (
    <UniverseContext.Provider
      value={{
        config,
        planets,
        edges,
        killed,
        killedLinks,
        selectedId,
        hoveredId,
        route,
        routeResult,
        isSending,
        packetTransmitKey,
        sceneSettings,
        copilotReport,
        copilotMeta,
        copilotError,
        isCopilotSending,
        linkHealthMap,
        chimeraTick,
        trafficHistory,
        packetLegRef,
        packetProgressRef,
        packetResumeProgress,
        rerouteNotice,
        packetHeld,
        heldAtPlanet,
        setSceneSettings,
        setLinkHealthMap,
        setChimeraTick,
        resetView,
        resetViewTick,
        setSelectedId,
        setHoveredId,
        toggleKill,
        toggleKillLink,
        sendPacket,
        sendCopilot,
      }}
    >
      {children}
    </UniverseContext.Provider>
  );
}

export function useUniverse() {
  const ctx = useContext(UniverseContext);
  if (!ctx) throw new Error("useUniverse must be used within UniverseProvider");
  return ctx;
}
