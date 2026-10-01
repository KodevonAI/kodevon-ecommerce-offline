import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite un segundo servidor de desarrollo (p. ej. la demo) sin pisar `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    // Fotos de producto subidas a Vercel Blob desde el admin.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
