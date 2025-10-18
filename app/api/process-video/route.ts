import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    console.log("🟢 [STEP 1] Received request for video processing");

    const { videoUrl, chartImageBase64 } = await req.json();
    if (!videoUrl || !chartImageBase64) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tempDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const videoPath = path.join(tempDir, "input.mp4");
    const chartPath = path.join(tempDir, "chart.png");
    const outputPath = path.join(tempDir, "final_output.mp4");

    const isDevelopment = process.env.NEXT_PUBLIC_NODE_ENV === "development";
    let videoBuffer: Buffer;
    if (isDevelopment) {
      console.log("🧪 [DEV MODE] Using local sample video.");
      const localVideoPath = path.join(process.cwd(), "public/video/sample.mp4");
      videoBuffer = fs.readFileSync(localVideoPath);
    } else {
      console.log("🚀 [PROD MODE] Downloading video from HeyGen URL:", videoUrl);
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`Failed to download video: ${res.statusText}`);
      videoBuffer = Buffer.from(await res.arrayBuffer());
    }
    fs.writeFileSync(videoPath, videoBuffer);
    console.log("✅ [STEP 6] Video source processed and saved.");

    const base64Data = chartImageBase64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(chartPath, base64Data, "base64");
    console.log("✅ [STEP 7] Chart image saved.");

    // Get video metadata
    const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => {
        if (err) return reject(new Error("Failed to probe video"));
        resolve(data);
      });
    });

    const videoDuration = metadata.format.duration || 0;
    const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");
    console.log(`🎤 Video has audio: ${hasAudio}, Duration: ${videoDuration}s`);

    // --- START: FFmpeg without background music ---
    console.log("🟢 [STEP 9] Starting FFmpeg processing (no background music)...");

    await new Promise((resolve, reject) => {
      const breakTime = isDevelopment ? 2 : 10;
      const chartDuration = 5;

      if (videoDuration < breakTime) {
        return reject(new Error("Video is shorter than the planned break time."));
      }

      const command = ffmpeg(videoPath).input(chartPath);
      const complexFilter: string[] = [];

      // Split video
      complexFilter.push(`[0:v]trim=start=0:end=${breakTime},setpts=PTS-STARTPTS[v_part1]`);
      complexFilter.push(`[1:v]loop=loop=${chartDuration * 25}:size=1,trim=duration=${chartDuration},scale=${metadata.streams[0].width}:${metadata.streams[0].height},setpts=PTS-STARTPTS[v_part2]`);
      complexFilter.push(`[0:v]trim=start=${breakTime},setpts=PTS-STARTPTS[v_part3]`);

      // Audio handling (no music)
      if (hasAudio) {
        complexFilter.push(`[0:a]atrim=start=0:end=${breakTime},asetpts=PTS-STARTPTS[a_part1]`);
        complexFilter.push(`[0:a]atrim=start=${breakTime},asetpts=PTS-STARTPTS[a_part3]`);

        // Silence (no audio) during chart part
        complexFilter.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${chartDuration}[a_silent]`);

        // Combine
        complexFilter.push(`[a_part1][a_silent][a_part3]concat=n=3:v=0:a=1[final_a]`);
      } else {
        // Pure silence for entire duration if no audio
        complexFilter.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${videoDuration + chartDuration}[final_a]`);
      }

      // Merge all video segments
      complexFilter.push(`[v_part1][v_part2][v_part3]concat=n=3:v=1:a=0[final_v]`);

      command
        .complexFilter(complexFilter)
        .outputOptions([
          "-map [final_v]",
          "-map [final_a]",
          "-c:v libx264",
          "-c:a aac",
        ])
        .on("start", (cmd) => console.log("🟢 [STEP 10] FFmpeg command:", cmd))
        .on("progress", (progress) => console.log("🎞️ [FFmpeg Progress]", progress.timemark))
        .on("end", () => {
          console.log("✅ [STEP 11] FFmpeg processing completed (no background music).");
          resolve(true);
        })
        .on("error", (err, stdout, stderr) => {
          console.error("❌ [STEP 11] FFmpeg failed:", err.message);
          console.error("FFmpeg stderr:\n", stderr);
          reject(new Error("FFmpeg processing failed"));
        })
        .save(outputPath);
    });

    const videoBufferOut = fs.readFileSync(outputPath);
    const videoBase64 = videoBufferOut.toString("base64");

    fs.unlinkSync(videoPath);
    fs.unlinkSync(chartPath);
    fs.unlinkSync(outputPath);

    console.log("✅ [STEP 14] All steps completed successfully (no music).");

    return NextResponse.json({
      message: "✅ Video processed successfully (no background music)",
      video: `data:video/mp4;base64,${videoBase64}`,
    });
  } catch (err: any) {
    console.error("❌ [FINAL ERROR] API Route error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
