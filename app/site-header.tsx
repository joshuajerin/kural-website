"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

export function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const [hasPassedHero, setHasPassedHero] = useState(false);

  useEffect(() => {
    const updateHeader = () => {
      setHasPassedHero(window.scrollY > 4);
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("resize", updateHeader);

    return () => {
      window.removeEventListener("scroll", updateHeader);
      window.removeEventListener("resize", updateHeader);
    };
  }, []);

  return (
    <header
      className={`${styles.header} ${hasPassedHero ? styles.headerSolid : ""}`}
      ref={headerRef}
    >
      <Link className={styles.wordmark} href="#top" aria-label="Kural home">
        <span className={styles.wordmarkText}><span className={styles.wordmarkK}>k</span>ural</span>
      </Link>
      <Link className={styles.navCta} href="#early-access">Pre-order</Link>
    </header>
  );
}
