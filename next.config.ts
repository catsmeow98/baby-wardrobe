import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Photos are served through signed URLs from the private Supabase bucket (phase 2).
};

export default nextConfig;
