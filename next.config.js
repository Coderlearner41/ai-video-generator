/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
    "@ffprobe-installer/ffprobe" 
  ],
};

module.exports = nextConfig;