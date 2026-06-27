"use client";

import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { MOUSE, TOUCH } from "three";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from "@/lib/solar-system/camera";
import { useUniverse } from "@/context/UniverseContext";

export function CameraRig() {
  const { camera, gl } = useThree();
  const { selectedId, planets, resetViewTick } = useUniverse();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const animating = useRef(false);
  const goalPosition = useRef(new THREE.Vector3());
  const goalTarget = useRef(new THREE.Vector3());

  const startAnimation = (pos: THREE.Vector3, target: THREE.Vector3) => {
    goalPosition.current.copy(pos);
    goalTarget.current.copy(target);
    animating.current = true;
  };

  const applyMouseBindings = (controls: OrbitControlsImpl) => {
    controls.mouseButtons.LEFT = MOUSE.PAN;
    controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = MOUSE.ROTATE;
    controls.touches.ONE = TOUCH.PAN;
    controls.touches.TWO = TOUCH.DOLLY_ROTATE;
    controls.screenSpacePanning = true;
  };

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.copy(DEFAULT_CAMERA_TARGET);
    controls.zoomToCursor = true;
    applyMouseBindings(controls);
    controls.update();
  }, []);

  // Right-drag orbit needs the browser context menu disabled on the canvas.
  useEffect(() => {
    const canvas = gl.domElement;
    const blockContextMenu = (event: MouseEvent) => event.preventDefault();
    canvas.addEventListener("contextmenu", blockContextMenu);
    return () => canvas.removeEventListener("contextmenu", blockContextMenu);
  }, [gl]);

  useEffect(() => {
    if (!selectedId) return;
    const planet = planets.find((p) => p.node.id === selectedId);
    if (!planet) return;

    const planetPos = new THREE.Vector3(...planet.position);
    const r = planet.visualRadius;
    const offset = new THREE.Vector3(r * 0.6, r * 1.4, r * 2.8);
    startAnimation(planetPos.clone().add(offset), planetPos);
  }, [selectedId, planets]);

  useEffect(() => {
    if (resetViewTick === 0) return;
    startAnimation(
      DEFAULT_CAMERA_POSITION.clone(),
      DEFAULT_CAMERA_TARGET.clone(),
    );
  }, [resetViewTick]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.minDistance = 2;
    controls.maxDistance = 140;
  }, [selectedId, planets]);

  const handleControlStart = () => {
    animating.current = false;
    const controls = controlsRef.current;
    if (controls) applyMouseBindings(controls);
  };

  useFrame(() => {
    const controls = controlsRef.current;
    if (!animating.current || !controls) return;

    camera.position.lerp(goalPosition.current, 0.08);
    controls.target.lerp(goalTarget.current, 0.08);
    controls.update();

    if (
      camera.position.distanceTo(goalPosition.current) < 0.12 &&
      controls.target.distanceTo(goalTarget.current) < 0.12
    ) {
      camera.position.copy(goalPosition.current);
      controls.target.copy(goalTarget.current);
      controls.update();
      animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={DEFAULT_CAMERA_TARGET}
      enableDamping
      dampingFactor={0.06}
      enablePan
      enableZoom
      enableRotate
      zoomToCursor
      panSpeed={1.25}
      rotateSpeed={0.85}
      minDistance={2}
      maxDistance={140}
      screenSpacePanning
      mouseButtons={{
        LEFT: MOUSE.PAN,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.ROTATE,
      }}
      touches={{
        ONE: TOUCH.PAN,
        TWO: TOUCH.DOLLY_ROTATE,
      }}
      onStart={handleControlStart}
    />
  );
}
