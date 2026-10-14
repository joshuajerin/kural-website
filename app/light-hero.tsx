"use client";

import { type ReactNode, useEffect, useRef } from "react";
import styles from "./light-hero.module.css";
import { createHeroLightField } from "./hero-light-field";

const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function LightHero({ children, className }: { children: ReactNode; className: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!root || !video || !canvas) return;
    video.pause();
    video.currentTime = 0;
    root.style.setProperty("--footage-mix", "0");
    const field = createHeroLightField(canvas);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!field) {
      root.style.setProperty("--text-reveal", "1");
      root.dataset.lightState = "fallback";
      return;
    }
    let disposed = false;
    let failed = false;
    let elapsed = 0;
    let previous = 0;
    let frame = 0;
    let inView = false;
    let finished = false;
    let playRequested = false;

    const measure = () => field.measure(root, video);
    let lastDraw = 0;
    const playOrbit = () => {
      if (elapsed < 5200 || finished || playRequested || motion.matches) return;
      playRequested = true;
      // Retry blocked autoplay on the next user interaction, not every frame.
      void video.play().catch(() => {});
    };
    const tick = (now: number) => {
      if (failed) return;
      elapsed += previous ? Math.min(now - previous, 80) : 0;
      previous = now;
      const power = motion.matches ? 1 : ease((elapsed - 450) / 2400);
      const reveal = motion.matches ? 1 : ease((elapsed - 1000) / 2100);
      root.style.setProperty("--lamp-power", power.toFixed(3));
      root.style.setProperty("--text-reveal", reveal.toFixed(3));
      root.dataset.lightState = reveal === 1 ? "lit" : "revealing";
      // Withdraw the beam before the lamp moves, avoiding a detached light cone.
      const retreat = motion.matches ? 1 : ease((elapsed - 3400) / 1500);
      root.style.setProperty("--light-retreat", retreat.toFixed(3));
      root.style.setProperty("--footage-mix", ease(video.currentTime / 0.75).toFixed(3));
      if (now - lastDraw >= 1000 / 30 || motion.matches) {
        field.draw(motion.matches ? 0 : elapsed / 1000, power, retreat);
        lastDraw = now;
      }
      playOrbit();
      if (!motion.matches) frame = requestAnimationFrame(tick);
      else frame = 0;
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (inView && !document.hidden) {
        frame = requestAnimationFrame(tick);
      } else {
        video.pause();
        playRequested = false;
      }
      if (motion.matches) {
        video.pause();
        playRequested = false;
      }
    };
    const onEnded = () => { finished = true; };
    const onContextLost = () => {
      failed = true;
      cancelAnimationFrame(frame);
      video.pause();
      delete root.dataset.physicalType;
      root.style.setProperty("--text-reveal", "1");
      root.dataset.lightState = "fallback";
    };
    const onInteraction = () => {
      if (inView && !document.hidden && !finished) {
        playRequested = false;
        playOrbit();
      }
    };
    const resize = new ResizeObserver(() => {
      measure();
      if (motion.matches) sync();
    });
    resize.observe(root);
    const copy = root.querySelector<HTMLElement>("[data-illuminated-copy]");
    if (copy) resize.observe(copy);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }, { threshold: 0.12 });
    measure();
    void document.fonts.ready.then(() => { if (!disposed) measure(); });
    observer.observe(root);
    video.addEventListener("ended", onEnded);
    canvas.addEventListener("webglcontextlost", onContextLost);
    root.addEventListener("pointerdown", onInteraction);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      disposed = true;
      delete root.dataset.physicalType;
      cancelAnimationFrame(frame);
      field.destroy();
      resize.disconnect();
      observer.disconnect();
      video.pause();
      video.removeEventListener("ended", onEnded);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      root.removeEventListener("pointerdown", onInteraction);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  return (
    <section ref={rootRef} className={`${className} ${styles.stage}`} aria-labelledby="hero-title" data-light-state="dark">
      <video ref={videoRef} className={styles.robot} muted playsInline preload="auto"
        poster="/media/kural-camera-orbit-poster.png" aria-label="Kural lamp illuminating the headline, followed by a full robot orbit">
        <source src="/media/kural-camera-orbit-preview.mp4" type="video/mp4" />
      </video>
      <div className={`${styles.robot} ${styles.openingFrame}`} aria-hidden="true" />
      <div className={styles.atmosphere} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.light} aria-hidden="true" />
      {children}
    </section>
  );
}
