/** @type {import('next').NextConfig} */
const nextConfig = {
    // No more 'experimental' block for this setting
    serverExternalPackages: [
      "@ffmpeg-installer/ffmpeg",
      "@ffprobe-installer/ffprobe",
      "fluent-ffmpeg",
    ],
  };
  
  module.exports = nextConfig;