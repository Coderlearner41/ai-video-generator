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

    const { videoUrl, chartUrl, audioUrl } = await req.json();

    if (!videoUrl || !chartUrl || !audioUrl) {
      return NextResponse.json({ error: "Missing videoUrl, chartUrl, or audioUrl" }, { status: 400 });
    }

    // --- Detect whether it’s a Heygen video or Blob asset ---
    const isHeygenVideo = videoUrl.includes("heygen.com");
    console.log("📦 Video source:", isHeygenVideo ? "Heygen CDN" : "Vercel Blob");

    // --- Use Vercel temp directory ---
    const tempDir = "/tmp";
    const videoPath = path.join(tempDir, "input.mp4");
    const chartPath = path.join(tempDir, "chart.png");
    const audioPath = path.join(tempDir, "bg_audio.mp3");
    const outputPath = path.join(tempDir, "final_output.mp4");

    // --- Download video from URL (works for both Blob or Heygen) ---
    console.log("⬇️ Downloading video:", videoUrl);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.statusText}`);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    fs.writeFileSync(videoPath, videoBuffer);

    // --- Download chart image ---
    console.log("🖼️ Downloading chart:", chartUrl);
    const chartRes = await fetch(chartUrl);
    if (!chartRes.ok) throw new Error(`Failed to download chart: ${chartRes.statusText}`);
    const chartBuffer = Buffer.from(await chartRes.arrayBuffer());
    fs.writeFileSync(chartPath, chartBuffer);

    // --- Download audio ---
    console.log("🎵 Downloading audio:", audioUrl);
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.statusText}`);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    fs.writeFileSync(audioPath, audioBuffer);

    // --- Probe metadata to detect existing audio ---
    const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => (err ? reject(err) : resolve(data)));
    });
    const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");
    console.log(`🎤 Video has audio: ${hasAudio}`);

    // --- FFmpeg Processing ---
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(videoPath).input(chartPath).input(audioPath);

      const complexFilter = [
        `[0:v][1:v]overlay=enable='between(t,0,5)'[v_out]`,
        hasAudio
          ? `[0:a][2:a]amix=inputs=2:duration=first:dropout_transition=3:weights='1 0.25'[a_out]`
          : `[2:a]acopy[a_out]`,
      ];

      command
        .complexFilter(complexFilter)
        .outputOptions(["-map [v_out]", "-map [a_out]", "-c:v libx264", "-c:a aac", "-shortest"])
        .on("start", (cmd) => console.log("🟢 FFmpeg command:", cmd))
        .on("progress", (progress) => console.log("🎞️ Progress:", progress.timemark))
        .on("end", () => {
          console.log("✅ FFmpeg processing completed");
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err.message);
          reject(err);
        })
        .save(outputPath);
    });

    // --- Convert to base64 ---
    const videoBufferOut = fs.readFileSync(outputPath);
    const videoBase64Out = videoBufferOut.toString("base64");

    // --- Cleanup ---
    await new Promise((res) => setTimeout(res, 200));
    [videoPath, chartPath, audioPath, outputPath].forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
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
