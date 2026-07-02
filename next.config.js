/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Socket.IO to work alongside Next.js custom server
  webpack: (config) => {
    config.externals = config.externals || [];
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
