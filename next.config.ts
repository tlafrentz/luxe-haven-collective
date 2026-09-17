import type { NextConfig } from "next";

if (
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production" &&
  (!process.env.AUTH_EMAIL_ACTION_ENCRYPTION_KEY ||
    process.env.AUTH_EMAIL_ACTION_ENCRYPTION_KEY.length < 32)
) {
  throw new Error("AUTH_EMAIL_ACTION_ENCRYPTION_KEY must be configured for Production");
}

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
      {
        source: "/stays/mesa-downtown-retreat",
        destination: "/stays/mesa",
        permanent: true,
      },
      {
        source: "/stays/mesa-downtown-retreat/:path*",
        destination: "/stays/mesa/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/update-password",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/auth/email-action/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/shared/investment-report/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // LHS-SEC-006: narrow frame/connect allowance for the Hospitable
        // Direct booking widget and checkout boundary. Hostnames are
        // placeholders pending the real Hospitable Direct account
        // configuration — see docs/Product/lhs-001-mesa-direct-booking.md.
        source: "/stays/:slug/book",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; frame-src 'self' https://*.hospitable.com; connect-src 'self' https://*.hospitable.com; img-src 'self' https: data:; script-src 'self' https://*.hospitable.com 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'`,
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
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
