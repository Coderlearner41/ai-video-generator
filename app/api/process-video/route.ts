import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import ffprobeInstaller from "@ffprobe-installer/ffprobe"

ffmpeg.setFfmpegPath(ffmpegInstaller.path)
ffmpeg.setFfprobePath(ffprobeInstaller.path)

export async function POST(req: Request) {
  try {
    console.log("🟢 Received request for video overlay processing")

    const { type, videoUrl, videoBase64, chartImageBase64 } = await req.json()

    if (!chartImageBase64) {
      return NextResponse.json({ error: "Missing chart image" }, { status: 400 })
    }

    const tempDir = "/tmp"
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

    const videoPath = path.join(tempDir, "input.mp4")
    const chartPath = path.join(tempDir, "chart.png")
    const outputPath = path.join(tempDir, "final_output.mp4")

    const chartData = chartImageBase64.replace(/^data:image\/png;base64,/, "")
    fs.writeFileSync(chartPath, chartData, "base64")

    // Download or decode video
    if (type === "base64") {
      const videoData = videoBase64.replace(/^data:video\/mp4;base64,/, "")
      fs.writeFileSync(videoPath, videoData, "base64")
      console.log("✅ Video loaded from base64")
    } else if (type === "url") {
      if (!videoUrl) throw new Error("Missing videoUrl for url type")

      // If it's a local /public path, copy directly
      if (videoUrl.startsWith("/video/")) {
        const publicPath = path.join(process.cwd(), "public", videoUrl)
        fs.copyFileSync(publicPath, videoPath)
        console.log("✅ Copied local sample video")
      } else {
        const res = await fetch(videoUrl)
        if (!res.ok) throw new Error(`Failed to fetch video: ${res.statusText}`)
        const buffer = Buffer.from(await res.arrayBuffer())
        fs.writeFileSync(videoPath, buffer)
        console.log("✅ Downloaded video from URL")
      }
    }

    // FFmpeg overlay only (no audio mix)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .input(chartPath)
        .complexFilter([
          "[0:v][1:v]overlay=enable='between(t,0,5)'[v_out]",
        ])
        .outputOptions(["-map [v_out]", "-c:v libx264", "-preset veryfast", "-shortest"])
        .on("start", (cmd) => console.log("🟢 FFmpeg command:", cmd))
        .on("end", () => {
          console.log("✅ FFmpeg overlay complete")
          resolve()
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err)
          reject(err)
        })
        .save(outputPath)
    })

    const videoBufferOut = fs.readFileSync(outputPath)
    const videoBase64Out = videoBufferOut.toString("base64")

    return NextResponse.json({
      message: "✅ Video processed successfully (overlay only)",
      video: `data:video/mp4;base64,${videoBase64Out}`,
    })
  } catch (err: any) {
    console.error("❌ API Error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
