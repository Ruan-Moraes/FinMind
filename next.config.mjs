/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.VERCEL ? '.next' : process.env.NEXT_BUILD_DIR || '.next',
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql', 'libsql', 'unpdf', 'xlsx'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
