"use client";

import { createContext, useState, type ReactNode } from "react";
import { LoadingScreen } from "./loading-screen";

export type HeroLoadStatus = "loading" | "ready" | "error";
export const HeroLoadingContext = createContext<(status: HeroLoadStatus) => void>(() => {});

export function HeroLoading({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<HeroLoadStatus>("loading");
  return (
    <HeroLoadingContext.Provider value={setStatus}>
      <LoadingScreen status={status} />
      {children}
    </HeroLoadingContext.Provider>
  );
}
