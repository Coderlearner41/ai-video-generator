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

  const hasStartedGeneration = useRef(false)
  const MAX_WORDS = 90
  const safeCommentary =
    typeof commentary === "string" ? commentary.replace(/^"|"$/g, "") : ""
  const trimmedCommentary = safeCommentary.split(" ").slice(0, MAX_WORDS).join(" ")

  useEffect(() => {
    async function generateAndProcessVideo() {
      if (hasStartedGeneration.current || !commentary || commentary.length < 20) return
      hasStartedGeneration.current = true

      try {
        setLoading(true)
        setError("")
        setVideoUrl("")
        setStatus("🚀 Starting video generation...")

        const isProd = process.env.NODE_ENV === "production"
        console.log("isProd:", isProd)

        let heygenVideoUrl = ""
        let chartBase64 = ""
        let audioBase64 = ""

        // ✅ 1️⃣ Generate or get HeyGen video
        const heygenBody = {
          video_inputs: [
            {
              character: { type: "avatar", avatar_id: avatar, avatar_style: "normal" },
              voice: { type: "text", input_text: trimmedCommentary, voice_id: voice, speed: 1.5 },
              background: { type: "color", value: "#000000" },
            },
          ],
          dimension: { width: 1280, height: 720 },
        }

        if (isProd) {
          setStatus("🎬 Generating HeyGen video...")
          const res = await fetch("/api/heygen-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(heygenBody),
          })

          if (!res.ok) throw new Error("Failed to start HeyGen video generation.")
          const data = await res.json()
          const videoId = data.data?.video_id
          if (!videoId) throw new Error("No video_id from HeyGen.")

          // Poll HeyGen until ready
          let ready = false
          while (!ready) {
            await new Promise((r) => setTimeout(r, 25000))
            const check = await fetch(`/api/heygen-video?id=${videoId}`)
            const checkData = await check.json()
            if (checkData.data?.video_url) {
              heygenVideoUrl = checkData.data.video_url
              ready = true
            } else if (checkData.data?.status === "failed") {
              throw new Error("HeyGen generation failed.")
            }
          }
        } else {
          // Dev fallback
          heygenVideoUrl = "/video/sample.mp4"
          setStatus("🧩 Using sample video in dev mode...")
        }

        // ✅ 2️⃣ Get chart base64 (already in localStorage)
        setStatus("📊 Preparing chart image...")
        const chartFromStorage = localStorage.getItem("chartImage")
        if (!chartFromStorage) throw new Error("Chart image not found in localStorage.")
        chartBase64 = chartFromStorage

        // ✅ 3️⃣ Convert audio to base64
        setStatus("🎵 Loading audio...")
        const audioRes = await fetch("/song/ipl_11.mp3")
        const audioArrayBuffer = await audioRes.arrayBuffer()
        const audioBase64Str = Buffer.from(audioArrayBuffer).toString("base64")
        audioBase64 = `data:audio/mpeg;base64,${audioBase64Str}`

        // ✅ 4️⃣ Process via /api/process-video
        setStatus("🎞️ Sending data to process-video API...")
        const processRes = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: heygenVideoUrl,
            chartBase64,
            audioBase64,
          }),
        })

        if (processRes.ok) {
          const processed = await processRes.json()
          if (processed?.video) {
            setVideoUrl(processed.video)
            setStatus("✅ Final processed video ready!")
            return
          }
        }

        // ✅ 5️⃣ Fallback: use HeyGen video only
        setStatus("⚠️ FFmpeg failed or not available, showing HeyGen video only.")
        setVideoUrl(heygenVideoUrl)
      } catch (err: any) {
        console.error("❌ Video processing error:", err)
        setError(err.message || "Unexpected error.")
        setStatus("⚠️ Something went wrong.")
      } finally {
        setLoading(false)
      }
    }

    generateAndProcessVideo()

    return () => {
      hasStartedGeneration.current = false
    }
  }, [avatar, voice, commentary, trimmedCommentary])

  return (
    <Card className="bg-slate-800 border-orange-500/30 p-6 space-y-4">
      <h3 className="text-orange-400 font-bold mb-2">🎥 AI Video Commentary</h3>
      {status && <p className="text-sm text-gray-300">{status}</p>}
      {loading && <p className="text-orange-400 animate-pulse">Please wait...</p>}
      {error && <p className="text-red-400 font-semibold">{error}</p>}
      {!loading && videoUrl && (
        <video key={videoUrl} src={videoUrl} controls autoPlay className="w-full rounded-lg" />
      )}
      {!loading && !videoUrl && !error && (
        <p className="text-gray-400 italic">AI video will appear here once generated.</p>
      )}
    </Card>
  )
}
