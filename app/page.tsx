import {
  ChefHat,
  CircleDot,
  Grip,
  Lightbulb,
  Move3d,
  Navigation,
  ScanLine,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "./site-header";
import { WaitlistForm } from "./waitlist-form";
import styles from "./page.module.css";

const videos = [
  {
    stem: "base",
    position: "50% 50%",
  },
  {
    stem: "pancake",
    position: "50% 50%",
  },
  {
    stem: "fruit",
    position: "50% 50%",
  },
  {
    stem: "light",
    position: "50% 50%",
  },
] as const;

const modules = [
  {
    icon: Grip,
    number: "M01",
    name: "Parallel gripper",
    copy: "The everyday tool for controlled pick-and-place, sorting, and object handoff.",
    status: "Available",
  },
  {
    icon: ChefHat,
    number: "M02",
    name: "Silicone spatula",
    copy: "A fitted wrist-roll attachment for cooking-surface interaction and flipping tasks.",
    status: "Available",
  },
  {
    icon: Lightbulb,
    number: "M03",
    name: "Reader light",
    copy: "A compact lighting module for bringing illumination exactly where it is needed.",
    status: "Available",
  },
  {
    icon: CircleDot,
    number: "M04",
    name: "Vacuum gripper",
    copy: "A planned module for smooth, delicate, or difficult-to-pinch surfaces.",
    status: "Coming soon",
  },
] as const;

export default function Home() {
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  return (
    <main>
      <section className={styles.hero} id="top" aria-labelledby="hero-title">
        <SiteHeader />

        <div className={styles.videoGrid} aria-hidden="true">
          {videos.map((video, index) => (
            <div className={styles.videoTile} key={video.stem}>
              <video
                className={styles.video}
                autoPlay
                loop
                muted
                playsInline
                preload={index < 2 ? "auto" : "metadata"}
                poster={`/media/${video.stem}-poster.jpg`}
                style={{ objectPosition: video.position }}
              >
                <source src={`/media/${video.stem}.webm`} type="video/webm" />
                <source src={`/media/${video.stem}.mp4`} type="video/mp4" />
              </video>
              <Image
                className={styles.motionPoster}
                src={`/media/${video.stem}-poster.jpg`}
                alt=""
                fill
                priority={index < 2}
                sizes="50vw"
                style={{ objectPosition: video.position }}
              />
            </div>
          ))}
        </div>

        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <h1 id="hero-title">Introducing Kural</h1>
          <p className={styles.heroSummary}>A modular mobile manipulator</p>
          <Link className={styles.heroCta} href="#early-access">Join waitlist</Link>
        </div>
      </section>

      <section className={styles.intro} id="product">
        <div className={styles.sectionLabel}>
          <span>01</span>
          <p>The product</p>
        </div>
        <div className={styles.introContent}>
          <p className={styles.eyebrow}>Built for the space between demos and daily life.</p>
          <h2>One machine.<br />Many kinds of work.</h2>
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
          <div><strong>03</strong><span>Modules now</span></div>
        </div>
      </section>

      <section className={styles.reasoning}>
        <div className={styles.reasoningIntro}>
          <div className={`${styles.sectionLabel} ${styles.sectionLabelDark}`}>
            <span>02</span>
            <p>Why Kural</p>
          </div>
          <div>
            <p className={styles.eyebrowDark}>Robots should adapt to the room, not the other way around.</p>
            <h2>Useful hardware<br />should stay useful.</h2>
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

      <section className={styles.modules} id="modules">
        <div className={styles.modulesHeading}>
          <div className={`${styles.sectionLabel} ${styles.sectionLabelDark}`}>
            <span>03</span>
            <p>Wrist modules</p>
          </div>
          <h2>Change the tool.<br />Keep the platform.</h2>
          <p>
            Kural’s wrist-roll interface lets one robot shift between handling,
            cooking, illumination, and future task-specific tools.
          </p>
        </div>
        <div className={styles.moduleGrid}>
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <article className={styles.module} key={module.number}>
                <div className={styles.moduleTopline}>
                  <span>{module.number}</span>
                  <span className={module.status === "Coming soon" ? styles.soon : styles.available}>
                    {module.status}
                  </span>
                </div>
                <Icon aria-hidden="true" size={34} strokeWidth={1.4} />
                <h3>{module.name}</h3>
                <p>{module.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.earlyAccess} id="early-access">
        <div className={styles.pricingCopy}>
          <div className={styles.sectionLabel}>
            <span>04</span>
            <p>Early access</p>
          </div>
          <p className={styles.eyebrow}>Reserve your place. No charge today.</p>
          <h2>
            <span>From</span>
            $49
            <small>/ month</small>
          </h2>
          <p className={styles.priceSummary}>
            Join the first group helping shape a more useful, modular robot for
            homes, studios, and robotics labs.
          </p>
        </div>
        <div className={styles.formArea}>
          <WaitlistForm configured={clerkConfigured} />
        </div>
      </section>

      <footer className={styles.footer}>
        <small>© 2026 Kural</small>
      </footer>
    </main>
  );
}
