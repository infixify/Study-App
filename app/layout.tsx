// app/layout.tsx
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import PostHogInit from "@/components/PostHogInit";
import FcmSync from "@/components/FcmSync";
import { HeaderProvider } from "@/components/dashboard/AppHeader";

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
          html, body {
            -webkit-overflow-scrolling: touch;
            text-rendering: optimizeSpeed;
          }
          * {
            -webkit-tap-highlight-color: transparent;
          }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // 1. Theme recovery
                const saved = localStorage.getItem("prepwise_theme");
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                if (saved === "dark" || (!saved && prefersDark)) {
                  document.documentElement.classList.add("dark");
                } else {
                  document.documentElement.classList.remove("dark");
                }

                // 2. ZERO-FLASH AUTH REDIRECT:
                // Runs synchronously in 0ms BEFORE React renders login UI
                const isAuth = Object.keys(localStorage).some(function(k) {
                  return (k.includes("auth-token") || k.includes("sb-")) && 
                         (localStorage.getItem(k) || "").includes("access_token");
                });
                if (isAuth && (window.location.pathname === "/" || window.location.pathname === "/login")) {
                  window.location.replace("/dashboard");
                }
              } catch (_) {}

              // 3. Safe Media Service Worker Registration
              if (typeof window !== "undefined" && "serviceWorker" in navigator) {
                window.addEventListener("load", function() {
                  navigator.serviceWorker.register("/sw.js").catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-body bg-paper text-ink antialiased selection:bg-teal-500/20">
        <PostHogInit />
        <FcmSync />
        <HeaderProvider>
          {children}
        </HeaderProvider>
      </body>
    </html>
  );
}
