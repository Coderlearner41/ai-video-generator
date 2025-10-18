import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(req: Request) {
  let videoUrl = "";
  try {
    console.log("🟢 Received request for video processing");

    const body = await req.json();
    videoUrl = body.videoUrl;
    const { chartUrl, audioUrl } = body;

    if (!videoUrl || !chartUrl || !audioUrl) {
      return NextResponse.json(
        { error: "Missing videoUrl, chartUrl, or audioUrl" },
        { status: 400 }
      );
    }

    const tempDir = "/tmp"; // ✅ Writable on Vercel
    const videoPath = path.join(tempDir, "input.mp4");
    const chartPath = path.join(tempDir, "chart.png");
    const audioPath = path.join(tempDir, "bg_audio.mp3");
    const outputPath = path.join(tempDir, "final_output.mp4");

    // --- Download Inputs ---
    console.log("⬇️ Downloading video:", videoUrl);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.statusText}`);
    fs.writeFileSync(videoPath, Buffer.from(await videoRes.arrayBuffer()));

    console.log("🖼️ Downloading chart:", chartUrl);
    const chartRes = await fetch(chartUrl);
    if (!chartRes.ok) throw new Error(`Failed to download chart: ${chartRes.statusText}`);
    fs.writeFileSync(chartPath, Buffer.from(await chartRes.arrayBuffer()));

    console.log("🎵 Downloading audio:", audioUrl);
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.statusText}`);
    fs.writeFileSync(audioPath, Buffer.from(await audioRes.arrayBuffer()));

    // --- FFmpeg Processing ---
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .input(chartPath)
        .input(audioPath)
        .complexFilter([
          `[0:v][1:v]overlay=enable='between(t,0,5)'[v_out]`,
          `[2:a]acopy[a_out]`,
        ])
        .outputOptions([
          "-map [v_out]",
          "-map [a_out]",
          "-c:v libx264",
          "-c:a aac",
          "-shortest",
        ])
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
    console.error("❌ Processing failed:", err.message);

    // ⚙️ Fallback: Return the original video URL instead of error
    return NextResponse.json({
      message: "⚠️ FFmpeg failed — returning original video",
      fallback: true,
      video: videoUrl,
      error: err.message,
    });
  }
}
