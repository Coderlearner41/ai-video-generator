import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import ffprobeInstaller from "@ffprobe-installer/ffprobe"
import { put } from "@vercel/blob"

ffmpeg.setFfmpegPath(ffmpegInstaller.path)
ffmpeg.setFfprobePath(ffprobeInstaller.path)

export async function POST(req: Request) {
  try {
    const { videoUrl, chartBase64, audioBase64 } = await req.json()

    if (!videoUrl) {
      return NextResponse.json({ error: "Missing videoUrl" }, { status: 400 })
    }

    // 🧩 Create a temporary working directory
    const tempDir = path.join("/tmp", `process_${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    const inputVideoPath = path.join(tempDir, "input.mp4")
    const chartPath = path.join(tempDir, "chart.png")
    const audioPath = path.join(tempDir, "audio.mp3")
    const outputPath = path.join(tempDir, "output.mp4")

    // --- 1️⃣ Download the video file
    const videoRes = await fetch(videoUrl)
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
    fs.writeFileSync(inputVideoPath, videoBuffer)

    // --- 2️⃣ Decode and write chart image
    if (chartBase64?.startsWith("data:image")) {
      const chartData = chartBase64.split(",")[1]
      fs.writeFileSync(chartPath, Buffer.from(chartData, "base64"))
    }

    // --- 3️⃣ Decode and write audio file
    if (audioBase64?.startsWith("data:audio")) {
      const audioData = audioBase64.split(",")[1]
      fs.writeFileSync(audioPath, Buffer.from(audioData, "base64"))
    }

    // --- 4️⃣ FFmpeg command
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg(inputVideoPath)
        .inputOptions(["-y"])
        .on("start", (cmd) => console.log("🎞️ FFmpeg started:", cmd))
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err)
          reject(err)
        })
        .on("end", () => {
          console.log("✅ FFmpeg finished successfully")
          resolve()
        })

      // Overlay chart if present
      if (fs.existsSync(chartPath)) {
        cmd.input(chartPath).complexFilter([
          "[0:v][1:v] overlay=W-w-20:H-h-20:enable='between(t,1,15)'",
        ])
      }

      // Mix audio if available
      if (fs.existsSync(audioPath)) {
        cmd.input(audioPath).audioCodec("aac").videoCodec("libx264").outputOptions([
          "-shortest",
          "-map 0:v",
          "-map 1:a?",
        ])
      }

      cmd.output(outputPath).run()
    })

    // --- 5️⃣ Upload processed file to Vercel Blob
    const finalVideo = fs.readFileSync(outputPath)
    const blob = await put(`processed_${Date.now()}.mp4`, finalVideo, {
      access: "public",
      addRandomSuffix: false,
    })

    // --- 🧹 Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true })

    return NextResponse.json({ video: blob.url })
  } catch (error: any) {
    console.error("❌ process-video failed:", error)
    // Return fallback (HeyGen video only)
    return NextResponse.json({
      video: error.videoUrl || null,
      error: "Processing failed, returning fallback video.",
    })
  }
}
