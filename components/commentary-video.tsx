"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"

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
  const MAX_WORDS = 90
  const hasStartedGeneration = useRef(false)
  const trimmedCommentary = commentary.split(" ").slice(0, MAX_WORDS).join(" ")

  useEffect(() => {
    async function generateAndProcessVideo() {
      if (hasStartedGeneration.current || !commentary || commentary.length < 20) return
      hasStartedGeneration.current = true

      try {
        setLoading(true)
        setError("")
        setVideoUrl("")

        let processedVideoUrl = ""

        const isProd = process.env.NEXT_PUBLIC_NODE_ENV === "production"
        if (isProd) {
          // 🎬 Use HeyGen API logic here (kept same if needed)
          setStatus("🎬 Generating HeyGen avatar video...")
          // processedVideoUrl = heygenUrl
        } else {
          // 🧩 Development mode — use local sample
          setStatus("📼 Using local sample video...")
          processedVideoUrl = "/video/sample.mp4"
        }

        const chartImageBase64 = localStorage.getItem("chartImage")
        if (!chartImageBase64) throw new Error("Chart image not found.")

        setStatus("🎞️ Processing video (overlay only)...")
        const processRes = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "url",
            videoUrl: processedVideoUrl,
            chartImageBase64,
          }),
        })

        if (!processRes.ok) {
          const errData = await processRes.json()
          throw new Error(errData.error || "FFmpeg processing failed.")
        }

        const processedData = await processRes.json()
        setVideoUrl(processedData.video)
        setStatus("✅ Final video ready!")
      } catch (err: any) {
        console.error(err)
        setError(err.message || "Unknown error")
        setStatus("❌ Failed to generate video.")
      } finally {
        setLoading(false)
      }
    }
    generateAndProcessVideo()
  }, [avatar, voice, commentary, trimmedCommentary])

  return (
    <Card className="bg-slate-800 border-orange-500/30 p-6 space-y-4">
      <h3 className="text-orange-400 font-bold mb-2">🎥 AI Video Commentary</h3>

      {status && <p className="text-sm text-gray-300">{status}</p>}
      {loading && <p className="text-orange-400 animate-pulse">Please wait, this may take a while...</p>}
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
