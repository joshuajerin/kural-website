"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./showcase-media.module.css";

const demos = [
  { stem: "light", label: "Reading light" },
  { stem: "fruit", label: "Fruit sorting" },
  { stem: "pancake", label: "Pancake flip" },
  { stem: "base", label: "Mobile base" },
] as const;

export function ShowcaseMedia({ variant }: { variant: "hero" | "feature" }) {
  const [selected, setSelected] = useState(0);
  const [playingStem, setPlayingStem] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackIntent = useRef<"auto" | "play" | "pause">("auto");
  const videoId = useId();
  const demo = variant === "hero" ? demos[3] : demos[selected];
  const isPlaying = playingStem === demo.stem;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    let disposed = false;

    const syncPlayback = () => {
      const shouldPlay =
        !disposed &&
        inView &&
        !document.hidden &&
        playbackIntent.current !== "pause" &&
        (playbackIntent.current === "play" || !motionPreference.matches);

      if (shouldPlay) {
        // A blocked autoplay leaves the poster and explicit Play control intact.
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              inView = entry.isIntersecting;
              syncPlayback();
            },
            { threshold: 0 },
          )
        : null;

    if (observer) {
      observer.observe(video);
    } else {
      inView = true;
      syncPlayback();
    }

    motionPreference.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);

    return () => {
      disposed = true;
      observer?.disconnect();
      motionPreference.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      video.pause();
    };
  }, [demo.stem]);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      playbackIntent.current = "play";
      void video.play().catch(() => {});
    } else {
      playbackIntent.current = "pause";
      video.pause();
    }
  }

  function selectDemo(direction: number) {
    setSelected((current) => (current + direction + demos.length) % demos.length);
  }

  return (
    <div className={`${styles.media} ${styles[variant]}`} data-demo={demo.stem}>
      <video
        key={demo.stem}
        id={videoId}
        ref={videoRef}
        className={styles.video}
        muted
        playsInline
        loop
        preload="metadata"
        poster={`/media/${demo.stem}-poster.jpg`}
        aria-label={`Kural prototype demo: ${demo.label}`}
        onPlay={() => setPlayingStem(demo.stem)}
        onPause={() => setPlayingStem(null)}
        onError={() => setPlayingStem(null)}
      >
        <source src={`/media/${demo.stem}.webm`} type="video/webm" />
        <source src={`/media/${demo.stem}.mp4`} type="video/mp4" />
        Your browser does not support this Kural prototype demo video.
      </video>

      {variant === "feature" && (
        <div className={styles.selector} role="group" aria-label="Prototype demos">
          <button
            className={styles.arrow}
            type="button"
            onClick={() => selectDemo(-1)}
            aria-label="Previous Kural prototype demo"
            aria-controls={videoId}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className={styles.label} aria-live="polite" aria-atomic="true">
            {demo.label}
          </span>
          <button
            className={styles.arrow}
            type="button"
            onClick={() => selectDemo(1)}
            aria-label="Next Kural prototype demo"
            aria-controls={videoId}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <button
        className={styles.playback}
        type="button"
        onClick={togglePlayback}
        aria-label={`${isPlaying ? "Pause" : "Play"} Kural prototype demo: ${demo.label}`}
        aria-controls={videoId}
      >
        {isPlaying ? (
          <Pause size={13} aria-hidden="true" />
        ) : (
          <Play size={13} aria-hidden="true" />
        )}
        <span>{isPlaying ? "Pause" : "Play"}</span>
      </button>
    </div>
  );
}
