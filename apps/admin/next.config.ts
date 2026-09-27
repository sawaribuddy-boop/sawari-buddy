import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@sawari/constants', '@sawari/domain', '@sawari/types', '@sawari/validation'],
  poweredByHeader: false,
};

export default nextConfig;
