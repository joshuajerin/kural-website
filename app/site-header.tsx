"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

export function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const [hasPassedHero, setHasPassedHero] = useState(false);

  useEffect(() => {
    const updateHeader = () => {
      const hero = document.getElementById("top");
      const headerHeight = headerRef.current?.offsetHeight ?? 72;
      setHasPassedHero(Boolean(hero && window.scrollY >= hero.offsetHeight - headerHeight));
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
        KURAL
      </Link>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link href="#product">Product</Link>
        <Link href="#modules">Modules</Link>
        <Link href="/sim">Simulator</Link>
        <Link className={styles.navCta} href="#early-access">
          Early access <ArrowRight aria-hidden="true" size={15} />
        </Link>
      </nav>
    </header>
  );
}
