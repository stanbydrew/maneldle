import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Doar pentru `npm run dev`: permite testarea de pe telefon din rețeaua locală
  // (ex. http://192.168.100.81:3000). Fără asta, JavaScript-ul e blocat și
  // butoanele nu răspund.
  allowedDevOrigins: ["192.168.*.*"],
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
