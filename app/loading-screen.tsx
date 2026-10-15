"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./loading-screen.module.css";

const MINIMUM_PLAYBACK_SECONDS = 1.8;

export function LoadingScreen() {
  const animation = useRef<HTMLVideoElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (hidden) return;
    const video = animation.current;
    if (!video) return;

    let disposed = false;
    let exiting = false;
    let playbackUnavailable = false;
    let playedSeconds = 0;
    let previousTime = video.currentTime;
    const startedAt = performance.now();
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const maybeExit = () => {
      if (disposed || exiting || document.hidden) return;
      const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-loader-scene]"));
      const sceneSettled = scenes.length > 0 && scenes.every((scene) =>
        scene.dataset.scene === "ready" || scene.dataset.scene === "unavailable",
      );
      const animationShown = playbackUnavailable
        ? performance.now() - startedAt >= MINIMUM_PLAYBACK_SECONDS * 1000
        : playedSeconds >= MINIMUM_PLAYBACK_SECONDS;
      if (!sceneSettled || !animationShown) return;
      exiting = true;
      setLeaving(true);
    };

    const onProgress = () => {
      const currentTime = video.currentTime;
      const delta = currentTime >= previousTime
        ? currentTime - previousTime
        : Number.isFinite(video.duration) ? video.duration - previousTime + currentTime : 0;
      if (!document.hidden) playedSeconds += Math.max(0, delta);
      previousTime = currentTime;
      maybeExit();
    };
    const onError = () => {
      if (disposed) return;
      playbackUnavailable = true;
      maybeExit();
    };
    const play = () => {
      if (disposed || document.hidden) return;
      previousTime = video.currentTime;
      void video.play().catch(onError);
    };
    const onVisibility = () => {
      previousTime = video.currentTime;
      if (document.hidden) video.pause();
      else { play(); maybeExit(); }
    };

    const observer = new MutationObserver(maybeExit);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-scene"] });
    video.addEventListener("timeupdate", onProgress);
    video.addEventListener("error", onError);
    video.addEventListener("canplay", play);
    document.addEventListener("visibilitychange", onVisibility);
    const minimumTimer = window.setTimeout(maybeExit, MINIMUM_PLAYBACK_SECONDS * 1000);
    if (video.error) onError();
    else play();
    maybeExit();

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(minimumTimer);
      video.removeEventListener("timeupdate", onProgress);
      video.removeEventListener("error", onError);
      video.removeEventListener("canplay", play);
      document.removeEventListener("visibilitychange", onVisibility);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <div
      className={`${styles.screen} ${leaving ? styles.leaving : ""}`}
      data-page-loader
      data-state={leaving ? "leaving" : "loading"}
      role="status"
      aria-label="Loading Kural"
      aria-hidden={leaving}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) setHidden(true);
      }}
    >
      <video
        ref={animation}
        className={styles.animation}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/media/loading-bot-poster.png"
        aria-hidden="true"
      >
        <source src="/media/loading-bot-fixed-table.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
