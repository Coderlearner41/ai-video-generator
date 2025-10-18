import { NextResponse } from "next/server"
import * as ffmpeg from "@ffmpeg/ffmpeg"


const { createFFmpeg, fetchFile } = ffmpeg as any

export async function POST(req: Request) {
  try {
    const ffmpeg = createFFmpeg({ log: true })
    if (!ffmpeg.isLoaded()) await ffmpeg.load()

    const body = await req.json()
    const { videoUrl, overlayUrl } = body

    const video = await fetchFile(videoUrl)
    const overlay = await fetchFile(overlayUrl)

    ffmpeg.FS("writeFile", "input.mp4", video)
    ffmpeg.FS("writeFile", "overlay.png", overlay)

    await ffmpeg.run(
      "-i", "input.mp4",
      "-i", "overlay.png",
      "-filter_complex", "overlay=10:10",
      "output.mp4"
    )

    const data = ffmpeg.FS("readFile", "output.mp4")
    const buffer = Buffer.from(data.buffer)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "video/mp4",
      },
    })
  } catch (e) {
    console.error("FFmpeg error:", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
