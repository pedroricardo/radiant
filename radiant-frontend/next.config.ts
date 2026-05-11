import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@radiant/backend", "@radiant/client"],
};

export default nextConfig;
