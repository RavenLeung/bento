import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Unbounded } from "next/font/google";
import "@/app/globals.css";
import { THEME_COLORS, THEME_STORAGE_KEY } from "@/lib/theme";

const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-unbounded",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Gemeshi Bento Lab · Build your bento",
    template: "%s · Gemeshi Bento Lab"
  },
  description: "Pick your protein, pile on vegetables and choose a starch. Build a bento that is yours.",
  applicationName: "Gemeshi Bento Lab",
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: THEME_COLORS.light
};

const themeInitScript = `(function(){try{var key=${JSON.stringify(THEME_STORAGE_KEY)};var colors=${JSON.stringify(THEME_COLORS)};var saved=localStorage.getItem(key);var theme=saved==="dark"||saved==="light"?saved:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var root=document.documentElement;root.classList.toggle("dark",theme==="dark");root.style.colorScheme=theme;document.querySelectorAll('meta[name="theme-color"]').forEach(function(meta){meta.setAttribute("content",colors[theme]);});}catch(error){}})();`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${unbounded.variable} min-h-dvh bg-rice font-body text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
