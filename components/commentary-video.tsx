"use client"

import { useState, useEffect } from "react"
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
  const trimmedCommentary = commentary.split(" ").slice(0, MAX_WORDS).join(" ")

  useEffect(() => {
    async function generateAndProcessVideo() {
      if (!commentary || commentary.length < 20) return
      try {
        setLoading(true)
        setError("")
        setVideoUrl("")
  
        const isProd = process.env.NEXT_PUBLIC_NODE_ENV === "production"
        let videoPayload: any = {}
        
        if (isProd) {
          // Production: Use HeyGen video URL
          setStatus("🎬 Generating HeyGen avatar video...")
          const response = await fetch("/api/heygen-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              video_inputs: [
                {
                  character: { type: "avatar", avatar_id: avatar, avatar_style: "normal" },
                  voice: { type: "text", input_text: trimmedCommentary, voice_id: voice, speed: 1.5 },
                },
              ],
              dimension: { width: 1280, height: 720 },
            }),
          })
          if (!response.ok) throw new Error("HeyGen API request failed.")
  
          const data = await response.json()
          const videoId = data.data?.video_id
          if (!videoId) throw new Error("No video_id returned from HeyGen.")
  
          // Poll for readiness
          setStatus("⏳ Waiting for HeyGen video to finish rendering...")
          let ready = false
          let heygenUrl = ""
          while (!ready) {
            await new Promise((r) => setTimeout(r, 25000))
            const statusRes = await fetch(`/api/heygen-video?id=${videoId}`)
            const statusData = await statusRes.json()
            if (statusData.data?.video_url) {
              ready = true
              heygenUrl = statusData.data.video_url
              setStatus("✅ HeyGen video ready. Preparing for processing...")
            } else if (statusData.data?.status === "failed") {
              throw new Error("Video generation failed on HeyGen.")
            }
          }
  
          videoPayload = { type: "url", videoUrl: heygenUrl }
  
        } else {
          // Development: Use sample video as Base64
          setStatus("🧩 Loading sample video (development mode)...")
          const sampleResponse = await fetch("/video/sample.mp4")
          const sampleBlob = await sampleResponse.blob()
          const sampleBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(sampleBlob)
          })
  
          videoPayload = { type: "base64", videoBase64: sampleBase64 }
        }
  
        // Get chart image
        let chartImageBase64: string | null = null
        for (let attempt = 0; attempt < 5; attempt++) {
          chartImageBase64 = localStorage.getItem("chartImage")
          if (chartImageBase64) break
          await new Promise((r) => setTimeout(r, 1500))
        }
        if (!chartImageBase64) throw new Error("Chart image not found in localStorage.")
  
        // Load background audio
        const audioResponse = await fetch("/song/ipl_11.mp3")
        const audioBlob = await audioResponse.blob()
        const audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(audioBlob)
        })
  
        // Send to server for processing
        setStatus("🎞️ Processing video with chart and audio...")
        const processRes = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...videoPayload,
            chartImageBase64,
            audioBase64,
          }),
        })
  
        if (!processRes.ok) throw new Error("FFmpeg processing failed.")
        const processedData = await processRes.json()
        if (!processedData.video) throw new Error("No processed video returned from server.")
  
        setVideoUrl(processedData.video)
        setStatus("✅ Final video ready!")
        alert("✅ Video processed successfully!")
  
      } catch (err: any) {
        console.error("❌ Video processing error:", err)
        setError(err.message || "Unexpected error while processing video.")
        setStatus("⚠️ Something went wrong during processing.")
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
