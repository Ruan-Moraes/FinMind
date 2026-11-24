/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.VERCEL ? '.next' : process.env.NEXT_BUILD_DIR || '.next',
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql', 'libsql', 'unpdf', 'xlsx'],
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
