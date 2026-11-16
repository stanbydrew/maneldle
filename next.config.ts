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
    // Paginile vizitate rămân în memoria browserului 5 minute: revenirea pe un
    // tab e instantă. Orice încercare (guessAction → updateTag) golește memoria,
    // deci progresul tău nu apare niciodată învechit; scorurile altora pot
    // întârzia până la 5 minute (un refresh le aduce imediat).
    staleTimes: { dynamic: 300 },
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
