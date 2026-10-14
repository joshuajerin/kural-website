import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LiveHero } from "./live-hero";
import { LoadingScreen } from "./loading-screen";
import { SiteHeader } from "./site-header";
import { ShowcaseMedia } from "./showcase-media";
import { ToolGallery } from "./tool-gallery";
import { WaitlistForm } from "./waitlist-form";
import styles from "./page.module.css";

const agents = [
  { name: "Grok bot", logo: "/media/agents/grok.svg" },
  { name: "Dots", logo: "/media/agents/openai.svg" },
  { name: "Instinct", logo: "/media/agents/instinct.png" },
];

export default function Home() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main id="top">
      <LoadingScreen />
      <SiteHeader />

      <LiveHero className={styles.hero} id="hero" headingId="hero-title">
        <div className={styles.heroCopy} data-illuminated-copy>
          <h1 id="hero-title" data-light-heading="Meet Kural">Meet Kural</h1>
          <p className={styles.heroSummary}>personal robots for homes</p>
          <Link className={styles.heroCta} href="#early-access">Pre-order Kural</Link>
          <p className={styles.heroNote}>Join early access · No charge today</p>
        </div>
      </LiveHero>

      <section className={styles.showcase} id="demonstrations" aria-labelledby="showcase-title">
        <div className={`${styles.sectionHeading} ${styles.showcaseHeading}`}>
          <p className={styles.eyebrow}>Autonomous navigation · Visual intelligence</p>
          <h2 id="showcase-title">One platform.<br />Built to adapt.</h2>
          <p>See how Kural reads a space, moves through it, and responds to what it sees.</p>
        </div>
        <div className={styles.showcaseStage} role="region" aria-label="Kural navigation and vision demos">
          <ShowcaseMedia variant="feature" />
          <div className={styles.showcaseFade} aria-hidden="true" />
        </div>
        <div className={styles.agentSection} aria-labelledby="agents-title">
          <p className={styles.eyebrow}>A flexible way to work</p>
          <h2 id="agents-title">Control it with your<br />AI agents.</h2>
          <ul className={styles.agentList} aria-label="AI agents">
            {agents.map((agent) => (
              <li key={agent.name}>
                <span className={styles.agentLogo} aria-hidden="true">
                  <Image src={agent.logo} alt="" width={76} height={76} />
                </span>
                <span className={styles.agentName}>{agent.name}</span>
                <Check className={styles.agentCheck} size={23} strokeWidth={2} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.modules} id="modules" aria-labelledby="modules-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Wrist modules</p>
          <h2 id="modules-title">Change the tool.<br />Keep the platform.</h2>
          <p>Start with the platform. Change what happens at the wrist.</p>
        </div>
        <ToolGallery />
      </section>

      <section className={styles.earlyAccess} id="early-access" aria-labelledby="preorder-title">
        <div className={styles.reservationPanel}>
          <div className={styles.reservationLayout}>
            <div className={styles.reservationPhoto}>
              <Image
                src="/media/what-comes-next-kural.jpg"
                alt="Kural robot fitted with its lamp tool at home."
                fill
                sizes="(max-width: 640px) calc(100vw - 68px), (max-width: 1023px) 42vw, 480px"
              />
            </div>
            <div className={styles.reservationCopy}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>Early access</p>
                <h2 id="preorder-title">Join the first homes.</h2>
                <p>Reserve your place. No charge today.</p>
              </div>
              <div className={styles.priceLine}><span>From</span><strong>$49</strong><span>/ month</span></div>
              <div className={styles.formArea}>
                <WaitlistForm configured={clerkConfigured} />
              </div>
              <p className={styles.reservationNote}>Early-access registration only. No payment is collected.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.footerWordmark} href="#top" aria-label="Kural home">kural</Link>
        <nav aria-label="Footer navigation">
          <Link href="#demonstrations">Demonstrations</Link>
          <Link href="#modules">Modules</Link>
          <Link href="https://github.com/joshuajerin/kural-skills">Skills</Link>
          <Link href="#early-access">Early access</Link>
        </nav>
        <p>© {new Date().getFullYear()} Kural</p>
      </footer>
    </main>
  );
}
