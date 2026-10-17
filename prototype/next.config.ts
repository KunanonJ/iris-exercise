import type { NextConfig } from "next";

// Default: Next.js serves UI + /api (Vercel / `pnpm dev`).
// USE_WORKER_API=1: proxy /api to Wrangler on 8797 (local Worker+D1 sandbox).
// WORKER_STATIC_EXPORT=1: emit `out/` for Cloudflare Worker asset binding (`pnpm build:worker`).
const useWorkerApi = process.env.USE_WORKER_API === "1";
const workerStaticExport = process.env.WORKER_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(workerStaticExport
    ? { output: "export" as const }
    : useWorkerApi
      ? {
          rewrites: async () => [
            { source: "/api/:path*", destination: "http://127.0.0.1:8797/api/:path*" },
          ],
        }
      : {}),
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
