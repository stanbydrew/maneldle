import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Paginile vizitate rămân în memoria browserului 60s: revenirea pe un tab
    // e instantă. Orice încercare (guessAction → updateTag) golește memoria,
    // deci progresul nu apare niciodată învechit.
    staleTimes: { dynamic: 60 },
  },
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
