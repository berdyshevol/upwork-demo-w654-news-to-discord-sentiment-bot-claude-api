import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The parent monorepo has its own lockfile; anchor Turbopack here so it
  // doesn't infer the wrong workspace root.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
