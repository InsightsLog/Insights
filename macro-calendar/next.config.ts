import type { NextConfig } from "next";

// Force environment validation at startup (dev server & build)
// This import runs zod validation and fails fast if env vars are missing
import "./src/lib/env";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default nextConfig;
