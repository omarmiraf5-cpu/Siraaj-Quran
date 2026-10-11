import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // Belt and braces behind the Cloudflare/Vercel 308: if a request for the
  // bare host reaches Next, send it to the canonical www host.
  async redirects() {
    const host = [{ type: "host" as const, value: "mydiiwaan.com" }];
    return [
      {
        source: "/",
        has: host,
        destination: "https://www.mydiiwaan.com",
        permanent: true,
      },
      {
        source: "/:path+",
        has: host,
        destination: "https://www.mydiiwaan.com/:path+",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
