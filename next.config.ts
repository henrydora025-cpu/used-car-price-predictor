import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image builds with NEXT_OUTPUT=standalone for a minimal runtime (see Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
