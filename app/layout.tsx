import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";

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
  themeColor: "#f7f2e8"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-AU">
      <body className="min-h-dvh bg-rice font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
