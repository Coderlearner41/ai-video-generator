"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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
    async function generateVideo() {
      if (hasStartedGeneration.current || !commentary || commentary.length < 20) return
      hasStartedGeneration.current = true

      try {
        setLoading(true)
        setError("")
        setVideoUrl("")
        setStatus("🚀 Starting video generation...")

        const isProd = process.env.NODE_ENV === "production"
        let heygenVideoUrl = ""

        // ✅ Generate or get HeyGen video
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

          // Poll until HeyGen video ready
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
          heygenVideoUrl = "/video/sample.mp4"
          setStatus("🧩 Using sample video in dev mode...")
        }

        setVideoUrl(heygenVideoUrl)
        setStatus("✅ Video ready!")
      } catch (err: any) {
        console.error("❌ Video generation error:", err)
        setError(err.message || "Unexpected error.")
        setStatus("⚠️ Something went wrong.")
      } finally {
        setLoading(false)
      }
    }

    generateVideo()

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
        <>
          <video key={videoUrl} src={videoUrl} controls autoPlay className="w-full rounded-lg" />
          <Button
            className="mt-2"
            onClick={() => {
              const a = document.createElement("a")
              a.href = videoUrl
              a.download = "commentary.mp4"
              a.click()
            }}
          >
            ⬇️ Download Video
          </Button>
        </>
      )}

      {!loading && !videoUrl && !error && (
        <p className="text-gray-400 italic">AI video will appear here once generated.</p>
      )}
    </Card>
  )
}
