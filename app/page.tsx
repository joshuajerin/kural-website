import {
  ArrowDown,
  ArrowRight,
  ChefHat,
  CircleDot,
  Eye,
  Grip,
  Lightbulb,
  Move3d,
  Navigation,
  ScanLine,
  Sparkles,
  Target,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { WaitlistForm } from "./waitlist-form";
import styles from "./page.module.css";

const videos = [
  {
    label: "Base manipulator",
    detail: "Mobile + articulated",
    stem: "base",
    position: "50% 50%",
  },
  {
    label: "Pancake flip",
    detail: "Spatula module",
    stem: "pancake",
    position: "50% 50%",
  },
  {
    label: "Fruit pick",
    detail: "Vision + grasping",
    stem: "fruit",
    position: "50% 50%",
  },
  {
    label: "Reader light",
    detail: "Light module",
    stem: "light",
    position: "50% 50%",
  },
] as const;

const tasks = [
  ["01", "Pick and place", "Reach, grasp, lift, and release small objects."],
  ["02", "Fruit sorting", "Identify and relocate multiple objects across a work surface."],
  ["03", "Small-item handling", "Manipulate cans, containers, and everyday objects."],
  ["04", "Pancake flipping", "Use an attached spatula to engage a cooking surface."],
  ["05", "Reading assistance", "Position a task light beside a seated reader."],
  ["06", "Home navigation", "Move through room-scale environments and approach work zones."],
  ["07", "Camera perception", "Observe from top and wrist-mounted viewpoints."],
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
      <section className={styles.hero} aria-labelledby="hero-title">
        <header className={styles.header}>
          <Link className={styles.wordmark} href="#top" aria-label="Kural home">
            KURAL
          </Link>
          <nav className={styles.nav} aria-label="Primary navigation">
            <Link href="#product">Product</Link>
            <Link href="#modules">Modules</Link>
            <Link className={styles.navCta} href="#early-access">
              Early access <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </nav>
        </header>

        <div className={styles.videoGrid} id="top" aria-hidden="true">
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
              <div className={styles.videoLabel}>
                <span>{video.label}</span>
                <small>{video.detail}</small>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <p className={styles.heroKicker}>A modular mobile manipulator</p>
          <h1 id="hero-title">Introducing Kural</h1>
          <p className={styles.heroSummary}>
            One adaptable robot for perception, movement, and useful work.
          </p>
        </div>
        <Link className={styles.scrollCue} href="#product">
          <span>Explore the system</span>
          <ArrowDown aria-hidden="true" size={18} />
        </Link>
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

      <section className={styles.tasks} id="tasks">
        <div className={styles.tasksHeading}>
          <div className={styles.sectionLabel}>
            <span>03</span>
            <p>Demonstrated tasks</p>
          </div>
          <div>
            <p className={styles.eyebrow}>A platform, not a party trick.</p>
            <h2>From the kitchen<br />to the workbench.</h2>
          </div>
          <p className={styles.prototypeNote}>
            Current footage shows simulated prototype demonstrations using the
            authored Kural robot and task environments.
          </p>
        </div>
        <div className={styles.taskList}>
          {tasks.map(([number, name, description], index) => {
            const icons = [Target, Sparkles, Grip, ChefHat, Lightbulb, Navigation, Eye];
            const Icon = icons[index];
            return (
              <article className={styles.taskRow} key={number}>
                <span className={styles.taskNumber}>{number}</span>
                <Icon aria-hidden="true" size={23} strokeWidth={1.6} />
                <h3>{name}</h3>
                <p>{description}</p>
                <span className={styles.demonstrated}>Demonstrated</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.modules} id="modules">
        <div className={styles.modulesHeading}>
          <div className={`${styles.sectionLabel} ${styles.sectionLabelDark}`}>
            <span>04</span>
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
            <span>05</span>
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
          <ul className={styles.terms}>
            <li>Availability and final plan inclusions are confirmed before activation.</li>
            <li>Taxes and shipping are not included.</li>
            <li>Cancel any time before billing begins.</li>
          </ul>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.wordmarkDark} href="#top" aria-label="Kural home">KURAL</Link>
        <p>Modular mobile manipulation.</p>
        <div>
          <Link href="#product">Product</Link>
          <Link href="#modules">Modules</Link>
          <Link href="#early-access">Early access</Link>
        </div>
        <small>© {new Date().getFullYear()} Kural. Prototype imagery shown.</small>
      </footer>
    </main>
  );
}
