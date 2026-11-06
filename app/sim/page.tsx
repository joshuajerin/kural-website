import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Poppy Simulator",
  description: "Control the Poppy mobile manipulator in a browser-based MuJoCo simulation.",
  alternates: { canonical: "/sim" },
};

export default function SimulatorPage() {
  return (
    <main className={styles.shell}>
      <iframe
        className={styles.simulator}
        src="/sim/index.html"
        title="Poppy robot simulator"
        allow="fullscreen"
      />
    </main>
  );
}
