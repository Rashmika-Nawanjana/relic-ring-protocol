"use client";

import dynamic from "next/dynamic";
import { useRef, type ReactNode, type RefObject } from "react";

const Scene = dynamic(() => import("@/components/canvas/Scene"), { ssr: false });

export function Layout({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative h-full min-h-full w-full touch-auto overflow-auto"
    >
      {children}
      <Scene
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
        }}
        eventSource={ref as RefObject<HTMLElement>}
        eventPrefix="client"
      />
    </div>
  );
}
