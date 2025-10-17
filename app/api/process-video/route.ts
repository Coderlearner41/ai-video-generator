import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export async function POST(req: Request) {
  try {
    console.log("🟢 Received request for video processing");

    const { type, videoUrl, videoBase64, chartImageBase64, audioBase64 } = await req.json();

    if (!chartImageBase64 || !audioBase64) {
      return NextResponse.json({ error: "Missing required chart or audio" }, { status: 400 });
    }

    const tempDir = "/tmp";
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const videoPath = path.join(tempDir, "input.mp4");
    const chartPath = path.join(tempDir, "chart.png");
    const audioPath = path.join(tempDir, "bg_audio.mp3");
    const outputPath = path.join(tempDir, "final_output.mp4");

    // 🎵 Save audio
    const audioData = audioBase64.replace(/^data:audio\/mp3;base64,/, "");
    fs.writeFileSync(audioPath, audioData, "base64");

    // 🖼 Save chart
    const chartData = chartImageBase64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(chartPath, chartData, "base64");

    // 🎬 Handle video input
    if (type === "base64") {
      if (!videoBase64) throw new Error("Missing videoBase64 for base64 type");
      const videoData = videoBase64.replace(/^data:video\/mp4;base64,/, "");
      fs.writeFileSync(videoPath, videoData, "base64");
      console.log("✅ Base64 video saved locally");
    } else if (type === "url") {
      if (!videoUrl) throw new Error("Missing videoUrl for url type");
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`Failed to download video: ${res.statusText}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(videoPath, buffer);
      console.log("✅ Video downloaded from URL and saved locally");
    } else {
      throw new Error("Invalid video type. Must be 'base64' or 'url'");
    }

    // 📊 Probe video metadata
    const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => (err ? reject(err) : resolve(data)));
    });

    const videoDuration = metadata.format.duration || 0;
    const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");

    console.log(`🎤 Video has audio: ${hasAudio}, Duration: ${videoDuration}s`);

    // ⚡ FFmpeg processing
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(videoPath).input(chartPath).input(audioPath);

      // Simple concat: video + chart + background audio
      const filters: string[] = [];
      filters.push(`[0:v][1:v]overlay=0:0:enable='between(t,0,5)'[v]`);
      command
        .complexFilter(filters)
        .outputOptions(["-map [v]", "-map 2:a?", "-c:v libx264", "-c:a aac"])
        .on("start", (cmd) => console.log("🟢 FFmpeg command:", cmd))
        .on("progress", (progress) => console.log("🎞️ FFmpeg progress:", progress.timemark))
        .on("end", () => {
          console.log("✅ FFmpeg processing completed");
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg failed:", err.message);
          reject(err);
        })
        .save(outputPath);
    });

    // Convert to Base64 for response
    const videoBufferOut = fs.readFileSync(outputPath);
    const videoBase64Out = videoBufferOut.toString("base64");

    // Cleanup temp files
    [videoPath, chartPath, audioPath, outputPath].forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));

    return NextResponse.json({
      message: "✅ Video processed successfully",
      video: `data:video/mp4;base64,${videoBase64Out}`,
    });
  } catch (err: any) {
    console.error("❌ API error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
