import Image from "next/image";
import Link from "next/link";
import { LoadingScreen } from "./loading-screen";
import { SiteHeader } from "./site-header";
import { WaitlistForm } from "./waitlist-form";
import styles from "./page.module.css";

const heroVideos = ["base", "pancake", "fruit", "light"] as const;

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
          <Link href="#early-access">Early access</Link>
        </nav>
        <p>© {new Date().getFullYear()} Kural</p>
      </footer>
    </main>
  );
}
