import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Photos are served through signed URLs from the private Supabase bucket (phase 2).
  // Background removal runs in the browser with Transformers.js, which must not pull in its Node-only packages.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, sharp$: false, 'onnxruntime-node$': false };
    return config;
  },
};

export default nextConfig;
