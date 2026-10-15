"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { HeroLoadStatus } from "./hero-loading";
import styles from "./loading-screen.module.css";

export function LoadingScreen({ status }: { status: HeroLoadStatus }) {
  const [animationLoaded, setAnimationLoaded] = useState(false);
  const [minimumShown, setMinimumShown] = useState(false);
  const [hidden, setHidden] = useState(false);
  const leaving = status === "ready" && minimumShown;

  useEffect(() => {
    if (!animationLoaded) return;
    const timer = window.setTimeout(() => setMinimumShown(true), 1200);
    return () => window.clearTimeout(timer);
  }, [animationLoaded]);

  useEffect(() => {
    if (hidden) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, [hidden]);

  if (hidden) return null;

  return (
    <div
      className={`${styles.screen} ${leaving ? styles.leaving : ""}`}
      data-page-loader
      data-state={leaving ? "leaving" : status}
      role="status"
      aria-label={status === "error" ? "Robot could not load" : "Loading Kural"}
      aria-hidden={leaving}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) setHidden(true);
      }}
    >
      <div className={styles.content}>
        <Image
          className={styles.animation}
          src="/media/loading-bot-tiny.gif"
          width={96}
          height={128}
          unoptimized
          loading="eager"
          alt=""
          onLoad={() => setAnimationLoaded(true)}
          onError={() => setAnimationLoaded(true)}
        />
        {status === "error" && (
          <div className={styles.error}>
            <p>The robot couldn’t load.</p>
            <button type="button" onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
