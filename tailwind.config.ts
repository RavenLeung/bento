import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1c241f",
        moss: "#244f3d",
        leaf: "#3f7a5d",
        rice: "#f7f2e8",
        paper: "#fffdf8",
        salmon: "#f28b72",
        yuzu: "#f4c95d",
        nori: "#17251e",
        chili: "#c9553d"
      },
      fontFamily: {
        display: ["ui-rounded", "\"Avenir Next\"", "Avenir", "system-ui", "sans-serif"],
        body: ["\"Avenir Next\"", "Avenir", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 16px 40px rgba(28, 36, 31, 0.10)",
        lift: "0 24px 80px rgba(28, 36, 31, 0.18)"
      },
      opacity: {
        2: "0.02",
        3: "0.03",
        4: "0.04",
        6: "0.06",
        8: "0.08",
        12: "0.12",
        15: "0.15",
        35: "0.35",
        38: "0.38",
        45: "0.45",
        52: "0.52",
        55: "0.55",
        65: "0.65"
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(.65) rotate(-8deg)", opacity: "0" },
          "70%": { transform: "scale(1.08) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0)", opacity: "1" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" }
        }
      },
      animation: {
        pop: "pop .35s cubic-bezier(.2,.9,.2,1.2) both",
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 8s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
