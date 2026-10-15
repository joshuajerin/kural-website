"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./loading-screen.module.css";

const EXIT_DURATION_MS = 980;

export function LoadingScreen() {
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);
  const exitStarted = useRef(false);

  useEffect(() => {
    const videos = Array.from(
      document.querySelectorAll<HTMLVideoElement>("video[data-loader-critical='true']"),
    );
    let exitTimer: number | undefined;

    const isReady = (video: HTMLVideoElement) =>
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA || video.error !== null;

    const beginExit = () => {
      if (exitStarted.current || !videos.every(isReady)) return;
      exitStarted.current = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setLeaving(true);
          exitTimer = window.setTimeout(() => setHidden(true), EXIT_DURATION_MS);
        });
      });
    };

    if (videos.length === 0) {
      beginExit();
      return;
    }

    videos.forEach((video) => {
      video.addEventListener("loadeddata", beginExit);
      video.addEventListener("canplay", beginExit);
      video.addEventListener("error", beginExit);
    });
    beginExit();

    return () => {
      videos.forEach((video) => {
        video.removeEventListener("loadeddata", beginExit);
        video.removeEventListener("canplay", beginExit);
        video.removeEventListener("error", beginExit);
      });
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`${styles.screen} ${leaving ? styles.leaving : ""}`}
      role="status"
      aria-label="Loading page"
      aria-hidden={leaving}
    >
      <video
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
