"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./showcase-media.module.css";

const demos = [
  { stem: "visual-intelligence", label: "Visual intelligence", webm: false },
  { stem: "autonomous-navigation", label: "Autonomous navigation", webm: false },
] as const;

export function ShowcaseMedia({ variant }: { variant: "hero" | "feature" }) {
  const [selected, setSelected] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoId = useId();
  const demo = demos[selected];
  const videoSource =
    variant === "hero"
      ? "/media/kural-camera-orbit-preview.mp4"
      : `/media/${demo.stem}.mp4`;
  const videoPoster =
    variant === "hero"
      ? "/media/kural-camera-orbit-poster.png"
      : undefined;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;

    const syncPlayback = () => {
      const shouldPlay =
        variant === "feature" &&
        !disposed &&
        !document.hidden;

      if (shouldPlay) {
        video.muted = true;
        if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && video.paused) {
          void video.play().then(
            () => delete video.dataset.playback,
            () => { video.dataset.playback = "blocked"; },
          );
        }
      } else {
        video.pause();
      }
    };

    document.addEventListener("visibilitychange", syncPlayback);
    video.addEventListener("canplay", syncPlayback);
    syncPlayback();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", syncPlayback);
      video.removeEventListener("canplay", syncPlayback);
      video.pause();
    };
  }, [variant, videoSource]);

  function selectDemo(direction: number) {
    setSelected((current) => (current + direction + demos.length) % demos.length);
  }

  return (
    <div
      className={`${styles.media} ${styles[variant]}`}
      data-demo={variant === "hero" ? "orbit-reveal" : demo.stem}
    >
      <video
        key={videoSource}
        id={videoId}
        ref={videoRef}
        className={styles.video}
        autoPlay={variant === "feature"}
        muted
        playsInline
        loop={variant === "feature"}
        preload={variant === "feature" ? "auto" : "metadata"}
        poster={videoPoster}
        aria-label={
          variant === "hero"
            ? "A full orbit reveal of Kural with its reading light module"
            : `Kural demo: ${demo.label}`
        }
      >
        {variant === "feature" && demo.webm && (
          <source src={`/media/${demo.stem}.webm`} type="video/webm" />
        )}
        <source src={videoSource} type="video/mp4" />
        Your browser does not support this Kural demo video.
      </video>

      {variant === "feature" && (
        <div className={styles.selector} role="group" aria-label="Kural demos">
          <button
            className={styles.arrow}
            type="button"
            onClick={() => selectDemo(-1)}
            aria-label="Previous Kural demo"
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
            aria-label="Next Kural demo"
            aria-controls={videoId}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

    </div>
  );
}
