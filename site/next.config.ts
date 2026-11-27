import type { NextConfig } from "next";

// Le site est servi par GitHub Pages sous /bnia-lab (sans domaine perso).
// La commande de publication définit NEXT_PUBLIC_BASE_PATH ; en local il reste vide.
// Avec un nom de domaine perso, construire avec NEXT_PUBLIC_BASE_PATH vide.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  // false : génère mentions-legales.html, comme l'ancien site (les liens existants restent valides)
  trailingSlash: false,
  images: { unoptimized: true },
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
