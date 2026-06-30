/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  compress: true,
  // Tree-shaking granular para librerías grandes
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs"],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
}

export default nextConfig
