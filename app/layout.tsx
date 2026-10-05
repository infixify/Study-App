// app/layout.tsx
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import PostHogInit from "@/components/PostHogInit";
import FcmSync from "@/components/FcmSync";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PrepWise — JEE/NEET/Boards Study Companion",
  description: "Track your prep, close your backlog, walk into the exam ready.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <style>{`
          /* 60 FPS Kinetic Scrolling & Hardware Acceleration for Android WebView */
          html, body {
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-y: contain;
            text-rendering: optimizeSpeed;
          }
          * {
            -webkit-tap-highlight-color: transparent;
          }
          /* Eliminate GPU stalls on scroll */
          .smooth-scroll {
            transform: translateZ(0);
            backface-visibility: hidden;
            will-change: scroll-position;
          }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem("prepwise_theme");
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                if (saved === "dark" || (!saved && prefersDark)) {
                  document.documentElement.classList.add("dark");
                } else {
                  document.documentElement.classList.remove("dark");
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="font-body bg-paper text-ink antialiased selection:bg-teal-500/20">
        <PostHogInit />
        <FcmSync />
        {children}
      </body>
    </html>
  );
}
