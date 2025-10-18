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

    // We no longer need 'type' or 'videoBase64' from the request
    const { videoUrl, chartImageBase64, audioBase64 } = await req.json();

    if (!videoUrl || !chartImageBase64 || !audioBase64) {
      return NextResponse.json({ error: "Missing videoUrl, chart, or audio" }, { status: 400 });
    }

    // Use /tmp, Vercel's only writable serverless directory
    const tempDir = "/tmp"; 
    const videoPath = path.join(tempDir, "input.mp4");
    const chartPath = path.join(tempDir, "chart.png");
    const audioPath = path.join(tempDir, "bg_audio.mp3");
    const outputPath = path.join(tempDir, "final_output.mp4");

    // 🎵 Save audio (small file, Base64 is fine)
    const audioData = audioBase64.replace(/^data:audio\/mp3;base64,/, "");
    fs.writeFileSync(audioPath, audioData, "base64");

    // 🖼 Save chart (small file, Base64 is fine)
    const chartData = chartImageBase64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(chartPath, chartData, "base64");

    // 🎬 Download video from the URL
    // This is a server-to-server request, so no CORS issues.
    console.log("✅ Downloading video from URL:", videoUrl);
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Failed to download video: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(videoPath, buffer);
    console.log("✅ Video downloaded from URL");

    const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => (err ? reject(err) : resolve(data)));
    });

    const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");
    console.log(`🎤 Video has audio: ${hasAudio}`);

    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(videoPath).input(chartPath).input(audioPath);
      
      const complexFilter = [
        // Overlay chart on video for the first 5 seconds
        `[0:v][1:v]overlay=enable='between(t,0,5)'[v_out]`, 
        // Mix avatar audio with background audio (if avatar has audio)
        hasAudio 
          ? `[0:a][2:a]amix=inputs=2:duration=first:dropout_transition=3:weights='1 0.25'[a_out]`
          : `[2:a]acopy[a_out]` // Otherwise, just use the background audio
      ];
      
      command
        .complexFilter(complexFilter)
        .outputOptions([
            "-map [v_out]",
            "-map [a_out]",
            "-c:v libx264",
            "-c:a aac",
            "-shortest"
        ])
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

    const videoBufferOut = fs.readFileSync(outputPath);
    const videoBase64Out = videoBufferOut.toString("base64");

    // Added a small delay before cleanup to prevent EBUSY error
    await new Promise(res => setTimeout(res, 200));

    console.log("🧹 Cleaning up temp files...");
    [videoPath, chartPath, audioPath, outputPath].forEach((f) => {
        if(fs.existsSync(f)) fs.unlinkSync(f)
    });

    return NextResponse.json({
      message: "✅ Video processed successfully",
      video: `data:video/mp4;base64,${videoBase64Out}`,
    });
  } catch (err: any) {
    console.error("❌ API error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}