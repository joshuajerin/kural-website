import Image from "next/image";
import styles from "./tool-gallery.module.css";

const tools = [
  {
    name: "Lamp",
    image: "/media/modules/lamp-arm.png",
    alt: "Kural arm with its curved trapezoid lamp and translucent diffuser attached to the wrist.",
    copy: "Light, right where you need it.",
    comingSoon: false,
  },
  {
    name: "Gripper",
    image: "/media/modules/gripper-r1-arm.png",
    alt: "Kural arm with its custom white parallel palm gripper attached to the wrist.",
    copy: "A helping hand for everyday objects.",
    comingSoon: true,
  },
  {
    name: "Pump",
    image: "/media/modules/pump-arm.png",
    alt: "Kural arm with its motor-driven suction pump and white suction cup attached to the wrist.",
    copy: "A new way to pick up and move things.",
    comingSoon: true,
  },
] as const;

export function ToolGallery() {
  return (
    <div className={styles.gallery}>
      {tools.map((tool) => (
        <figure className={styles.card} key={tool.name}>
          <div className={styles.media}>
            {tool.comingSoon && <span className={styles.banner}>Coming soon</span>}
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
