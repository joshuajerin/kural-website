import { Check, Move3d, Navigation, ScanLine } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LiveHero } from "./live-hero";
import { LoadingScreen } from "./loading-screen";
import { SiteHeader } from "./site-header";
import { ShowcaseMedia } from "./showcase-media";
import { ToolGallery } from "./tool-gallery";
import { WaitlistForm } from "./waitlist-form";
import styles from "./page.module.css";

const heroVideos = ["base", "pancake", "fruit", "light"] as const;

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

      <section className={styles.landingHero} aria-labelledby="hero-title">
        <div className={styles.videoGrid} aria-hidden="true">
          {heroVideos.map((stem, index) => (
            <div className={styles.videoTile} key={stem}>
              <video
                className={styles.heroVideo}
                autoPlay
                loop
                muted
                playsInline
                preload={index < 2 ? "auto" : "metadata"}
                poster={`/media/${stem}-poster.jpg`}
                data-loader-critical={index < 2 ? "true" : undefined}
              >
                <source src={`/media/${stem}.webm`} type="video/webm" />
                <source src={`/media/${stem}.mp4`} type="video/mp4" />
              </video>
              <Image
                className={styles.motionPoster}
                src={`/media/${stem}-poster.jpg`}
                alt=""
                fill
                priority={index < 2}
                sizes="50vw"
              />
            </div>
          ))}
        </div>
        <div className={styles.landingHeroShade} aria-hidden="true" />
        <div className={styles.landingHeroCopy}>
          <h1 id="hero-title">Introducing Kural</h1>
          <p>A modular mobile manipulator</p>
          <Link className={styles.heroCta} href="#early-access">Join waitlist</Link>
          <span className={styles.heroNote}>Early access · No charge today</span>
        </div>
      </section>

      <section className={styles.productIntro} id="product" aria-labelledby="product-title">
        <div className={styles.sectionLabel}>
          <span>01</span>
          <p>The product</p>
        </div>
        <div className={styles.introContent}>
          <p className={styles.eyebrow}>Built for the space between demos and daily life.</p>
          <h2 id="product-title">One machine.<br />Many kinds of work.</h2>
          <p className={styles.lead}>
            Kural combines a mobile base, vertical lift, six-axis SO-101 arm,
            onboard vision, and interchangeable wrist tools. It moves to the
            task, reaches the right height, sees the workspace, and acts with
            the tool the moment requires.
          </p>
        </div>
        <div className={styles.specRail} aria-label="Core system specifications">
          <div><strong>06</strong><span>Arm motions</span></div>
          <div><strong>01</strong><span>Vertical lift</span></div>
          <div><strong>02</strong><span>Driven wheels</span></div>
          <div><strong>03</strong><span>End effectors</span></div>
        </div>
      </section>

      <section className={styles.reasoning} aria-labelledby="why-title">
        <div className={styles.reasoningIntro}>
          <div className={`${styles.sectionLabel} ${styles.sectionLabelDark}`}>
            <span>02</span>
            <p>Why Kural</p>
          </div>
          <div>
            <p className={styles.eyebrowDark}>Robots should adapt to the room, not the other way around.</p>
            <h2 id="why-title">Useful hardware<br />should stay useful.</h2>
          </div>
          <p>
            Most machines are built around one fixed motion in one fixed place.
            Kural is designed as a system: mobile enough to move between work
            zones, tall enough to meet different surfaces, and modular enough
            to change what happens at the wrist.
          </p>
        </div>
        <div className={styles.process} aria-label="How Kural works">
          <article>
            <span>01</span>
            <Navigation aria-hidden="true" size={28} strokeWidth={1.6} />
            <h3>Move into position</h3>
            <p>The differential-drive base approaches the task while the lift sets working height.</p>
          </article>
          <article>
            <span>02</span>
            <ScanLine aria-hidden="true" size={28} strokeWidth={1.6} />
            <h3>See and align</h3>
            <p>Top and wrist viewpoints help frame objects, surfaces, and the next action.</p>
          </article>
          <article>
            <span>03</span>
            <Move3d aria-hidden="true" size={28} strokeWidth={1.6} />
            <h3>Reach and adapt</h3>
            <p>Six arm motions and a changeable wrist module turn perception into useful work.</p>
          </article>
        </div>
      </section>

      <section className={styles.lightSection} aria-labelledby="light-title">
        <div className={styles.lightSectionHeading}>
          <p className={styles.lightEyebrow}>A light you can direct</p>
          <h2>See the workspace<br />in a new light.</h2>
          <p>Move your cursor across the scene to aim Kural’s lamp and watch the light fall across the room.</p>
        </div>
        <LiveHero className={styles.interactiveHero} id="light-stage" headingId="light-title">
          <div className={styles.interactiveCopy} data-illuminated-copy>
            <h2 id="light-title" data-light-heading="Meet Kural">Meet Kural</h2>
          </div>
        </LiveHero>
      </section>

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
          <Link href="#product">Product</Link>
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
