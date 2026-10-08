import Image from "next/image";
import styles from "./tool-gallery.module.css";

const tools = [
  {
    name: "Gripper",
    image: "/media/fruit-poster.jpg",
    alt: "Kural prototype visualization with a wrist gripper holding fruit above a table.",
    copy: "A wrist tool for handling small objects.",
  },
  {
    name: "Spatula",
    image: "/media/pancake-poster.jpg",
    alt: "Kural prototype visualization with a spatula beside a pancake and cooking surface.",
    copy: "A different tool for a different kind of task.",
  },
  {
    name: "Reading light",
    image: "/media/light-poster.jpg",
    alt: "Kural prototype visualization with a reading light beside a seated person.",
    copy: "Bring illumination into the workspace.",
  },
] as const;

export function ToolGallery() {
  return (
    <div className={styles.gallery}>
      {tools.map((tool) => (
        <figure className={styles.card} key={tool.name}>
          <div className={styles.media}>
            <Image
              src={tool.image}
              alt={tool.alt}
              fill
              sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 899px) 640px, (max-width: 1264px) 33vw, 384px"
              className={styles.image}
            />
          </div>
          <figcaption className={styles.caption}>
            <h3 className={styles.name}>{tool.name}</h3>
            <p className={styles.copy}>{tool.copy}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
