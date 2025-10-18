"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { upload } from "@vercel/blob/client" // Vercel Blob upload

interface CommentaryVideoProps {
  avatar: string
  voice: string
  commentary: string
}

function base64ToBlob(base64: string, contentType: string = ''): Blob {
  const byteCharacters = atob(base64.split(',')[1]); // Remove the data:URL part
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export default function CommentaryVideo({ avatar, voice, commentary }: CommentaryVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [status, setStatus] = useState<string>("")

  // Prevent double execution in React StrictMode
  const hasStartedGeneration = useRef(false)

  const MAX_WORDS = 90
  const safeCommentary =
  typeof commentary === "string"
    ? commentary.replace(/^"|"$/g, "") // remove wrapping quotes if any
    : "";
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
  
        let videoUrlToProcess = ""
        let chartUrlToProcess = ""
        let audioUrlToProcess = ""
  
        // ✅ Prepare HeyGen body
        const heygenBody = {
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
                speed: 1.5,
              },
              background: {
                type: "color",
                value: "#000000",
              },
            },
          ],
          dimension: { width: 1280, height: 720 },
        }
  
        // --- 1️⃣ VIDEO GENERATION / FETCH ---
        if (isProd) {
          setStatus("🎬 Generating HeyGen avatar video...")
          const response = await fetch("/api/heygen-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(heygenBody),
          })
          if (!response.ok) throw new Error("HeyGen API request failed.")
          const data = await response.json()
          const videoId = data.data?.video_id
          if (!videoId) throw new Error("No video_id returned from HeyGen.")
  
          setStatus("⏳ Waiting for HeyGen to finish rendering...")
          let ready = false
          while (!ready) {
            await new Promise((r) => setTimeout(r, 25000))
            const statusRes = await fetch(`/api/heygen-video?id=${videoId}`)
            const statusData = await statusRes.json()
  
            if (statusData.data?.video_url) {
              videoUrlToProcess = statusData.data.video_url
              ready = true
            } else if (statusData.data?.status === "failed") {
              throw new Error("Video generation failed on HeyGen.")
            }
          }
  
          // Upload HeyGen video to blob for consistency
          const videoBlob = await (await fetch(videoUrlToProcess)).blob()
          const videoUpload = await upload("generated.mp4", videoBlob, {
            access: "public",
            handleUploadUrl: "/api/upload",
          })
          videoUrlToProcess = videoUpload.url
        } else {
          // --- 💻 DEV MODE ---
          setStatus("🧩 Uploading sample video (dev mode)...")
          const sampleRes = await fetch("/video/sample.mp4")
          if (!sampleRes.ok) throw new Error("Failed to fetch /video/sample.mp4")
          const sampleBlob = await sampleRes.blob()
  
          try {
            const videoUpload = await upload("sample.mp4", sampleBlob, {
              access: "public",
              handleUploadUrl: "/api/upload",
            })
            videoUrlToProcess = videoUpload.url
            setStatus("✅ Sample video uploaded to Blob.")
          } catch (err: any) {
            if (err?.message?.includes("already exists")) {
              console.warn("📦 Sample video already exists.")
              videoUrlToProcess = `https://YOUR_BLOB_STORE_ID.public.blob.vercel-storage.com/sample.mp4`
            } else throw err
          }
        }
  
        // --- 2️⃣ CHART UPLOAD ---
        setStatus("📊 Uploading chart image...")
        const chartBase64 = localStorage.getItem("chartImage")
        if (!chartBase64) throw new Error("Chart image not found in localStorage.")
        const chartBlob = base64ToBlob(chartBase64, "image/png")
        const chartUpload = await upload("chart.png", chartBlob, {
          access: "public",
          handleUploadUrl: "/api/upload",
        })
        chartUrlToProcess = chartUpload.url
        setStatus("✅ Chart image uploaded to Blob.")
  
        // --- 3️⃣ AUDIO UPLOAD ---
        setStatus("🎵 Uploading background audio...")
        const audioRes = await fetch("/song/ipl_11.mp3")
        if (!audioRes.ok) throw new Error("Failed to load background audio.")
        const audioBlob = await audioRes.blob()
        const audioUpload = await upload("ipl_11.mp3", audioBlob, {
          access: "public",
          handleUploadUrl: "/api/upload",
        })
        audioUrlToProcess = audioUpload.url
        setStatus("✅ Audio uploaded to Blob.")
  
        // --- 4️⃣ PROCESSING (server-side FFmpeg) ---
        setStatus("🎞️ Processing video with chart + audio...")
  
        const processRes = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: videoUrlToProcess,
            chartUrl: chartUrlToProcess,
            audioUrl: audioUrlToProcess,
          }),
        })
  
        if (!processRes.ok) {
          const errData = await processRes.json()
          throw new Error(errData.error || "FFmpeg processing failed.")
        }
  
        const processedData = await processRes.json()
        if (!processedData.video) throw new Error("No processed video returned.")
  
        setVideoUrl(processedData.video)
        setStatus("✅ Final video ready!")
      } catch (err: any) {
        console.error("❌ Video processing error:", err)
        setError(err.message || "Unexpected error.")
        setStatus("⚠️ Something went wrong.")
        alert(`Error:\n\n${err.message}`)
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
        <video
          key={videoUrl}
          src={videoUrl}
          controls
          autoPlay
          className="w-full rounded-lg"
        />
      )}
      {!loading && !videoUrl && !error && (
        <p className="text-gray-400 italic">AI video will appear here once generated.</p>
      )}
    </Card>
  )
}
