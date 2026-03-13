import type { NextConfig } from "next";

const framerPages = [
  "/about",
  "/blog",
  "/blog/:slug",
  "/contact",
  "/legal/:slug",
  "/pricing",
  "/waitlist",
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      // Home page → Framer export
      { source: "/", destination: "/framer/index.html" },
      // All other Framer pages
      ...framerPages.map((page) => ({
        source: page,
        destination: `/framer${page}/index.html`,
      })),
    ];
  },
};

export default nextConfig;
