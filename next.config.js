const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Nunca gera/serve service worker em dev — evita cache fantasma travando
  // hot-reload (dor de cabeça clássica de next-pwa). PWA "instalável" só
  // precisa valer em produção mesmo.
  disable: process.env.NODE_ENV === "development",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Fotos de liderança e anexos ficam no Supabase Storage.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
}

module.exports = withPWA(nextConfig)
