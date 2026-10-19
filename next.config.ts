import type { NextConfig } from "next";

const defaultMenuImageHosts = ["www.ja2square.com.au", "squarecdn.com", "**.squarecdn.com"];
const configuredMenuImageHosts = process.env.MENU_IMAGE_HOSTS?.trim();
const menuImageHosts = configuredMenuImageHosts
  ? configuredMenuImageHosts
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean)
  : defaultMenuImageHosts;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
  images: {
    remotePatterns: menuImageHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname
    }))
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
