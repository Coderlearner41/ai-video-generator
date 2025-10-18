/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Allow .wasm imports
    config.experiments = { asyncWebAssembly: true, layers: true };
    return config;
  },
};

module.exports = nextConfig;
