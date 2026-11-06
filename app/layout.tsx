import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Poppy Robotics - Your Personal Robot Agent";
const description =
  "Meet Poppy, a modular mobile manipulator built to move, see, reach, and adapt across everyday spaces.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kural.website"),
  title,
  description,
  applicationName: "Poppy Robotics",
  icons: {
    icon: { url: "/icon?brand=poppy-p-v1", type: "image/png", sizes: "64x64" },
    shortcut: "/icon?brand=poppy-p-v1",
  },
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Poppy Robotics",
    type: "website",
    images: [
      {
        url: "/og.png?brand=poppy-v1",
        width: 1200,
        height: 630,
        alt: "Poppy Robotics - Your Personal Robot Agent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png?brand=poppy-v1"],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

  return publishableKey ? (
    <ClerkProvider publishableKey={publishableKey}>{content}</ClerkProvider>
  ) : content;
}
