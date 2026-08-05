import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/public/owner-checklist/download": [
      "./private-assets/hospitality-owner-performance-checklist.pdf",
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/observe",
        destination: "/dashboard/observe/revenue",
        permanent: false,
      },
      {
        source: "/dashboard/insights",
        destination: "/dashboard/observe/revenue",
        permanent: false,
      },
      {
        source: "/dashboard/financial",
        destination: "/dashboard/observe/financial",
        permanent: false,
      },
      {
        source: "/dashboard/understand",
        destination: "/dashboard/understand/executive",
        permanent: false,
      },
      {
        source: "/dashboard/portfolio",
        destination: "/dashboard/understand/portfolio",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/shared/investment-report/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jumdtoraygqaraditnie.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "a0.muscache.com",
      },
    ],
  },
};

export default nextConfig;
