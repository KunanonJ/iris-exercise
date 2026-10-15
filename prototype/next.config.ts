import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Static export: the UI is client-rendered, so it ships as plain files that a
// Cloudflare Worker serves as static assets. The API lives in worker/index.ts.
// In `next dev`, /api is proxied to `wrangler dev` on port 8787.
const nextConfig: NextConfig = {
  ...(isDev
    ? { rewrites: async () => [{ source: "/api/:path*", destination: "http://127.0.0.1:8797/api/:path*" }] }
    : { output: "export" }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
