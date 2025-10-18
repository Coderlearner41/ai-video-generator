"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { upload } from "@vercel/blob/client" // Vercel Blob upload

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
      // Prevent duplicate runs
      if (hasStartedGeneration.current || !commentary || commentary.length < 20) return
      hasStartedGeneration.current = true

      try {
        setLoading(true)
        setError("")
        setVideoUrl("")
        setStatus("🚀 Starting video generation...")

        const isProd = process.env.NEXT_PUBLIC_NODE_ENV === "production"
        console.log("isProd:", isProd)
        let videoUrlToProcess = ""

        // ✅ Prepare HeyGen video generation request
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
              },
              background: {
                type: "color",
                value: "#000000",
              },
            },
          ],
          dimension: { width: 1280, height: 720 },
        }

        if (isProd) {
          // --- 🌍 PRODUCTION MODE ---
          setStatus("🎬 Generating HeyGen avatar video...")
          console.log(heygenBody)
          const response = await fetch("/api/heygen-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(heygenBody),
          })
          console.log(response)

          if (!response.ok) throw new Error("HeyGen API request failed.")
          const data = await response.json()
          const videoId = data.data?.video_id
          if (!videoId) throw new Error("No video_id returned from HeyGen.")

          setStatus("⏳ Waiting for HeyGen to finish rendering...")
          let ready = false
          while (!ready) {
            await new Promise((r) => setTimeout(r, 25000)) // wait 25 seconds before polling
            const statusRes = await fetch(`/api/heygen-video?id=${videoId}`)
            const statusData = await statusRes.json()

            if (statusData.data?.video_url) {
              videoUrlToProcess = statusData.data.video_url
              ready = true
            } else if (statusData.data?.status === "failed") {
              throw new Error("Video generation failed on HeyGen.")
            }
          }
        } else {
          // --- 💻 DEVELOPMENT MODE ---
          setStatus("🧩 Uploading sample video (dev mode)...")

          const sampleResponse = await fetch("/video/sample.mp4")
          if (!sampleResponse.ok) throw new Error("Failed to fetch /video/sample.mp4")
            const videoFile = await sampleResponse.blob()
          const expectedBlobUrl = `https://YOUR_BLOB_STORE_ID.public.blob.vercel-storage.com/sample.mp4`;
          videoUrlToProcess = expectedBlobUrl
          try {
            // Try to upload, but ignore the "already exists" error
            await upload("sample.mp4", videoFile, {
                access: "public",
                handleUploadUrl: "/api/upload",
            });
            setStatus("✅ Sample video uploaded/verified on Vercel Blob.");
         } catch (uploadError: any) {
            // Check if the error message indicates the blob already exists
            if (uploadError?.message?.includes('blob already exists')) {
                console.warn(" Vercel Blob: sample.mp4 already exists, using existing URL.");
                setStatus("✅ Sample video already exists on Vercel Blob.");
                // We already set videoUrlToProcess, so we just continue
            } else {
                // If it's a different error, re-throw it
                throw uploadError;
            }
         }
          setStatus("✅ Sample video uploaded to Vercel Blob.")
        }

        // --- 📊 COMMON LOGIC: Add chart and audio ---
        let chartImageBase64 = localStorage.getItem("chartImage")
        if (!chartImageBase64) throw new Error("Chart image not found in localStorage.")

        setStatus("🎵 Loading background audio...")
        const audioResponse = await fetch("/song/ipl_11.mp3")
        if (!audioResponse.ok) throw new Error("Failed to load background audio.")
        const audioBlob = await audioResponse.blob()

        const audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(audioBlob)
        })

        // --- 🧠 Send everything to FFmpeg API for final merge ---
        setStatus("🎞️ Processing video with audio and chart...")

        const processRes = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "url",
            videoUrl: videoUrlToProcess,
            chartImageBase64,
            audioBase64,
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
        const errorMessage = err.message || "Unexpected error."
        console.error("❌ Video processing error:", err)
        setError(errorMessage)
        setStatus("⚠️ Something went wrong.")
        alert(`Error:\n\n${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }

    generateAndProcessVideo()

    // Cleanup
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
