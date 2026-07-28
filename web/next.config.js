/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vssmililwzwmtnlkszix.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "fal.media",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "v3.fal.media",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "v3b.fal.media",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
