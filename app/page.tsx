import { Grip, Move3d, Navigation, StretchVertical } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ShowcaseMedia } from "./showcase-media";
import { ToolGallery } from "./tool-gallery";
import { WaitlistForm } from "./waitlist-form";
import styles from "./page.module.css";

const design = [
  { icon: Navigation, title: "Mobile base", copy: "Movement built into the platform." },
  { icon: StretchVertical, title: "Vertical lift", copy: "Bring the arm to the workspace." },
  { icon: Move3d, title: "Articulated arm", copy: "A compact, six-motion SO-101 assembly." },
  { icon: Grip, title: "Modular wrist", copy: "Different tools. The same platform." },
];

export default function Home() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main id="top">
      <header className={styles.header}>
        <Link className={styles.wordmark} href="#top" aria-label="Kural home">
          kural
        </Link>
        <nav className={styles.nav} aria-label="Primary navigation">
          <Link href="#product">Design</Link>
          <Link href="#demonstrations">In motion</Link>
          <Link href="#modules">Modules</Link>
        </nav>
        <Link className={styles.navCta} href="#early-access">Pre-order</Link>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <ShowcaseMedia variant="hero" />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <p className={styles.heroKicker}>Meet Kural</p>
          <h1 id="hero-title">Made to adapt.</h1>
          <p className={styles.heroSummary}>
            A modular mobile robot. One platform, more possibilities.
          </p>
          <Link className={styles.heroCta} href="#early-access">Pre-order Kural</Link>
          <p className={styles.heroNote}>Join early access · No charge today</p>
        </div>
        <span className={styles.heroMediaNote}>Prototype visualization</span>
      </section>

      <section className={styles.showcase} id="product" aria-labelledby="design-title">
        <div className={`${styles.sectionHeading} ${styles.showcaseHeading}`}>
          <p className={styles.eyebrow}>The design</p>
          <h2 id="design-title">One platform.<br />Built to change.</h2>
          <p>A mobile base, vertical lift, and articulated arm.<br />A simple idea with room to grow.</p>
        </div>
        <div className={styles.showcaseStage} id="demonstrations" role="region" aria-labelledby="showcase-title">
          <ShowcaseMedia variant="feature" />
          <div className={styles.showcaseFade} aria-hidden="true" />
          <div className={styles.showcaseCopy}>
            <p className={styles.showcaseKicker}>Kural in motion</p>
            <h2 id="showcase-title">Different tools.<br />New possibilities.</h2>
            <p>
              A reading light. A spatula. A gripper.<br />
              Explore the possibilities of a modular robot.
            </p>
            <Link href="#modules" className={styles.showcaseLink}>Meet the modules <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>

      <section className={styles.design} aria-label="Platform components">
        <div className={styles.designMedia}>
          <Image
            src="/media/base-poster.jpg"
            alt="Kural prototype visualization showing the mobile base, upright lift, and arm assembly."
            fill
            sizes="(max-width: 640px) 94vw, (max-width: 1100px) 86vw, 960px"
          />
          <Link className={styles.designMediaLink} href="#demonstrations">See Kural in motion <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.designDetails}>
          {design.map(({ icon: Icon, title, copy }) => (
            <article key={title}>
              <Icon size={24} strokeWidth={1.3} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.modules} id="modules" aria-labelledby="modules-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>The modules</p>
          <h2 id="modules-title">A new tool.<br />A new perspective.</h2>
          <p>Start with the platform.<br />Change what happens at the wrist.</p>
        </div>
        <ToolGallery />
      </section>

      <section className={styles.earlyAccess} id="early-access" aria-labelledby="preorder-title">
        <div className={styles.reservationPanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>What comes next</p>
            <h2 id="preorder-title">Pre-order Kural.</h2>
            <p>Join the early-access list for launch updates and availability.</p>
          </div>
          <div className={styles.formArea}>
            <WaitlistForm configured={clerkConfigured} />
          </div>
          <p className={styles.reservationNote}>Early-access registration only. No payment is collected.</p>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.footerWordmark} href="#top" aria-label="Kural home">kural</Link>
        <nav aria-label="Footer navigation">
          <Link href="#product">Design</Link>
          <Link href="#modules">Modules</Link>
          <Link href="https://github.com/joshuajerin/kural-skills">Skills</Link>
          <Link href="#early-access">Pre-order</Link>
        </nav>
        <p>© {new Date().getFullYear()} Kural <span aria-hidden="true">·</span> Prototype visuals</p>
      </footer>
    </main>
  );
}
