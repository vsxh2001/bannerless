import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server in `.next/standalone` (a minimal `server.js`
  // plus the traced `node_modules`) so the production Docker image stays slim.
  // In the Docker build the project lives at the image root with a real
  // `node_modules`, so the standalone entry is emitted at `.next/standalone/server.js`.
  // See node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
  output: "standalone",
};

export default nextConfig;
