"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./live-hero.module.css";

export function LiveHero({
  children,
  className,
  id = "hero",
  headingId = "hero-title",
}: { children: ReactNode; className: string; id?: string; headingId?: string }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const light = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stopped = false;
    let dispose: (() => void) | undefined;
    void import("./live-robot-scene").then(({ mountRobotScene }) => {
      if (stopped || !root.current || !canvas.current) return;
      dispose = mountRobotScene(root.current, canvas.current, light.current);
    }).catch(() => { if (root.current) root.current.dataset.scene = "unavailable"; });
    return () => { stopped = true; dispose?.(); };
  }, []);
  return (
    <section id={id} ref={root} className={`${className} ${styles.stage}`} data-scene="loading" aria-labelledby={headingId}>
      <canvas ref={canvas} className={styles.canvas} aria-label="Interactive Kural robot. Move your pointer to aim its lamp." role="img" />
      <canvas ref={light} className={`${styles.canvas} ${styles.light}`} aria-hidden="true" />
      {children}
      <p className={styles.loading} role="status">Bringing Kural to life<span> · · ·</span></p>
      <p className={styles.fallback}>The interactive robot needs WebGL. You can still explore Kural below.</p>
    </section>
  );
}
