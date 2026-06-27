"use client";

import {
  forwardRef,
  Suspense,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import {
  OrbitControls,
  PerspectiveCamera,
  View as ViewImpl,
} from "@react-three/drei";
import { Three } from "@/helpers/components/Three";

export function Common({ color }: { color?: string }) {
  return (
    <Suspense fallback={null}>
      {color && <color attach="background" args={[color]} />}
      <ambientLight intensity={0.4} />
      <pointLight position={[20, 30, 10]} intensity={2} decay={0.2} />
      <pointLight position={[-10, -10, -10]} color="#6366f1" decay={0.2} />
      <PerspectiveCamera makeDefault fov={40} position={[0, 0, 8]} />
    </Suspense>
  );
}

type ViewProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  orbit?: boolean;
};

export const View = forwardRef<HTMLDivElement, ViewProps>(
  ({ children, orbit, ...props }, ref) => {
    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

    return (
      <>
        <div ref={localRef} {...props} />
        <Three>
          <ViewImpl track={localRef as RefObject<HTMLElement>}>
            {children}
            {orbit && <OrbitControls />}
          </ViewImpl>
        </Three>
      </>
    );
  },
);

View.displayName = "View";
