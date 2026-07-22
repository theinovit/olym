import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // dockerode's optional SSH transport pulls in ssh2, which ships a
  // non-bundlable native asset (protocol/crypto.js) that breaks Turbopack's
  // build trace. Keep it external — it's server-only and never used at the
  // edge, so it can be required from node_modules at runtime instead.
  serverExternalPackages: ["dockerode"],
};

export default nextConfig;
