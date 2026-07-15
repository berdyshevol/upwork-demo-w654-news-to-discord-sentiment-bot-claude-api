import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          surface: "#313338",
          card: "#2b2d31",
          long: "#57F287",
          short: "#ED4245",
          neutral: "#95A5A6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
