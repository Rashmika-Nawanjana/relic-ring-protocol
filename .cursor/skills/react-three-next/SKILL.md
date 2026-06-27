---
name: react-three-next
description: >-
  React Three Fiber and react-three-next architecture for Next.js — persistent
  Canvas, tunnel-rat View portaling, gl.scissor multi-view, drei helpers, and
  3D star map components. Use when building StarMap, 3D visualizations, canvas
  scenes, orbit controls, or integrating @react-three/fiber with App Router.
paths: src/components/canvas/**, src/helpers/**, src/components/StarMap*
---

# React-Three-Next Stack

Based on [pmndrs/react-three-next](https://github.com/pmndrs/react-three-next).

## Architecture

- **Single persistent Canvas** — mounted once in `Layout`, survives page navigation
- **tunnel-rat** — portals 3D content from DOM into the shared Canvas
- **`<View />`** — tracks a DOM div; renders 3D via `gl.scissor` viewport segments
- **Events synchronized** — Canvas uses `eventSource` on the layout wrapper

```
src/
  components/
    canvas/
      Scene.tsx        # Global Canvas + r3f.Out
      View.tsx         # DOM-tracked 3D viewport + Common lights/camera
      StarMapScene.tsx # Planet spheres (M1 scaffold)
    dom/
      Layout.tsx       # Wraps pages + fixed Canvas overlay
  helpers/
    global.ts          # tunnel-rat instance
    components/Three.tsx  # r3f.In portal
```

## Usage

```tsx
import dynamic from "next/dynamic";
import { Common } from "@/components/canvas/View";
import { StarMapScene } from "@/components/canvas/StarMapScene";

const View = dynamic(
  () => import("@/components/canvas/View").then((m) => m.View),
  { ssr: false },
);

<div className="relative h-96 w-full">
  <View orbit className="relative h-full w-full">
    <StarMapScene />
    <Common color="#09090b" />
  </View>
</div>
```

- `orbit` — enables OrbitControls on that view
- `Common` — shared lights + camera per view
- Always `dynamic(..., { ssr: false })` for View and Scene consumers

## Stack

| Package | Role |
|---------|------|
| `three` | WebGL 3D library |
| `@react-three/fiber` | React renderer for Three.js |
| `@react-three/drei` | View, OrbitControls, Preload, helpers |
| `tunnel-rat` | Portal DOM → Canvas |

Optional (not installed): `@react-three/a11y`, `r3f-perf`.

## Rules

- Never mount a new `<Canvas>` per page — use `<View />` inside the global Scene
- Mark 3D components `"use client"`
- Lazy-load View with `dynamic` and a loading fallback
- Keep simulator math in `src/lib/`; 3D presentation in `src/components/canvas/`
- Load `universe-config.json` positions into StarMapScene (replace placeholder PLANETS array)

## GLSL imports (optional)

Add webpack loaders in `next.config.ts` for shader files:

```ts
webpack(config) {
  config.module.rules.push({
    test: /\.(glsl|vs|fs|vert|frag)$/,
    type: "asset/source",
  });
  return config;
}
```

## Scripts

```bash
npm run dev      # Next dev
npm run build    # Production build
npm run lint     # ESLint
```

## Maintainers

- [pmndrs/react-three-next](https://github.com/pmndrs/react-three-next) — Renaud ROHLINGER et al.
- Install fresh template: `npx create-r3f-app next my-app -ts`
