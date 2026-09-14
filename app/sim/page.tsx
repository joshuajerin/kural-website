import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Kural Simulator",
  description: "Control the Kural mobile manipulator in a browser-based MuJoCo simulation.",
  alternates: { canonical: "/sim" },
};

export default function SimulatorPage() {
  return (
    <main className={styles.shell}>
      <iframe
        className={styles.simulator}
        src="/sim/index.html"
        title="Kural robot simulator"
        allow="fullscreen"
      />
    </main>
  );
}
