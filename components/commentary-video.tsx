"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import * as ffmpeg from "@ffmpeg/ffmpeg"


const { createFFmpeg, fetchFile } = ffmpeg as any

interface CommentaryVideoProps {
  avatar: string
  voice: string
  commentary: string
}

export default function CommentaryVideo({ avatar, voice, commentary }: CommentaryVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [status, setStatus] = useState<string>("")
  const ffmpeg = createFFmpeg({ log: true })
  const MAX_WORDS = 90
  const trimmedCommentary = commentary.split(" ").slice(0, MAX_WORDS).join(" ")

  useEffect(() => {
    async function generateAndProcessVideo() {
      if (!commentary || commentary.length < 20) return
      try {
        setLoading(true)
        setError("")
        setVideoUrl("")

        const isProd = process.env.NEXT_PUBLIC_NODE_ENV === "production"
        let baseVideoUrl = ""

        // =================================
        // 🧠 1️⃣ Get Base Video
        // =================================
        if (isProd) {
          setStatus("🎬 Generating HeyGen avatar video...")
          const response = await fetch("/api/heygen-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              video_inputs: [
                {
                  character: {
                    type: "avatar",
                    avatar_id: avatar,
                    avatar_style: "normal",
                  },
                  voice: {
                    type: "text",
                    input_text: trimmedCommentary,
                    voice_id: voice,
                    speed: 1.3,
                  },
                },
              ],
              dimension: { width: 1280, height: 720 },
            }),
          })

          if (!response.ok) throw new Error("HeyGen API request failed.")
          const data = await response.json()
          const videoId = data.data?.video_id
          if (!videoId) throw new Error("No video_id returned from HeyGen.")

          // ⏳ Poll until video is ready
          setStatus("⏳ Waiting for HeyGen video rendering...")
          let ready = false
          while (!ready) {
            await new Promise((r) => setTimeout(r, 25000))
            const statusRes = await fetch(`/api/heygen-video?id=${videoId}`)
            const statusData = await statusRes.json()
            if (statusData.data?.video_url) {
              baseVideoUrl = statusData.data.video_url
              ready = true
            } else if (statusData.data?.status === "failed") {
              throw new Error("Video generation failed on HeyGen.")
            }
          }
        } else {
          baseVideoUrl = "/video/sample.mp4"
          setStatus("🧩 Using sample video from /public/video/sample.mp4")
        }

        // =================================
        // 🧠 2️⃣ Get Chart Image
        // =================================
        setStatus("📊 Getting chart image...")
        let chartImageBase64: string | null = null
        for (let attempt = 0; attempt < 5; attempt++) {
          chartImageBase64 = localStorage.getItem("chartImage")
          if (chartImageBase64) break
          console.log("⏳ Waiting for chart image...")
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
        if (!chartImageBase64) {
          throw new Error("Chart image not found in localStorage.")
        }

        // =================================
        // 🧠 3️⃣ Run FFmpeg in Browser (WASM)
        // =================================
        setStatus("🎞️ Processing video in browser with FFmpeg (WASM)...")

        if (!ffmpeg.isLoaded()) await ffmpeg.load()

        const videoFile = await fetchFile(baseVideoUrl)
        const overlayBlob = await fetchFile(chartImageBase64)

        ffmpeg.FS("writeFile", "input.mp4", videoFile)
        ffmpeg.FS("writeFile", "overlay.png", overlayBlob)

        await ffmpeg.run(
          "-i", "input.mp4",
          "-i", "overlay.png",
          "-filter_complex", "[0:v][1:v]overlay=enable='between(t,10,15)'[v]",
          "-map", "[v]",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "output.mp4"
        )

        const data = ffmpeg.FS("readFile", "output.mp4")
        const videoBlob = new Blob([data.buffer], { type: "video/mp4" })
        const outputUrl = URL.createObjectURL(videoBlob)

        setVideoUrl(outputUrl)
        setStatus("✅ Final video ready!")
      } catch (err: any) {
        console.error("❌ FFmpeg WASM error:", err)
        setError(err.message || "Video processing failed.")
        setStatus("⚠️ Something went wrong.")
      } finally {
        setLoading(false)
      }
    }

    generateAndProcessVideo()
  }, [avatar, voice, commentary])

  return (
    <Card className="bg-slate-800 border-orange-500/30 p-6 space-y-4">
      <h3 className="text-orange-400 font-bold mb-2">🎥 AI Video Commentary</h3>
      {status && <p className="text-sm text-gray-300">{status}</p>}
      {loading && <p className="text-orange-400 animate-pulse">Processing... please wait.</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && videoUrl && (
        <video
          key={videoUrl}
          src={videoUrl}
          controls
          autoPlay
          className="w-full rounded-lg border border-orange-400/30 shadow-lg"
        />
      )}
      {!loading && !videoUrl && !error && (
        <p className="text-gray-400 italic">AI video will appear here once generated.</p>
      )}
    </Card>
  )
}
