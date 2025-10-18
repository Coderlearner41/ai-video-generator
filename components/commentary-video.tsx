"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { upload } from '@vercel/blob/client'; // Import the Vercel Blob client

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
  
  // This ref prevents React 18's Strict Mode from running the effect twice
  const hasStartedGeneration = useRef(false);

  const MAX_WORDS = 90
  const trimmedCommentary = commentary.split(" ").slice(0, MAX_WORDS).join(" ")

  useEffect(() => {
    async function generateAndProcessVideo() {
      // Guard clause: stop if already running or no text
      if (hasStartedGeneration.current || !commentary || commentary.length < 20) return
      hasStartedGeneration.current = true;
      
      try {
        setLoading(true)
        setError("")
        setVideoUrl("")
    
        const isProd = process.env.NODE_ENV === "production"
        let videoUrlToProcess = ""; // This will hold the URL we send to the server
        
        if (isProd) {
          // --- PRODUCTION: GET HEYGEN URL ---
          setStatus("🎬 Generating HeyGen avatar video...")
          const response = await fetch("/api/heygen-video", { /* ... */ })
          if (!response.ok) throw new Error("HeyGen API request failed.")
          const data = await response.json()
          const videoId = data.data?.video_id
          if (!videoId) throw new Error("No video_id returned from HeyGen.")
  
          setStatus("⏳ Waiting for HeyGen video rendering...")
          let ready = false
          while (!ready) {
            await new Promise((r) => setTimeout(r, 25000))
            const statusRes = await fetch(`/api/heygen-video?id=${videoId}`)
            const statusData = await statusRes.json()
            if (statusData.data?.video_url) {
              videoUrlToProcess = statusData.data.video_url // We got the URL!
              ready = true
            } else if (statusData.data?.status === "failed") {
              throw new Error("Video generation failed on HeyGen.")
            }
          }
        } else {
          // --- DEVELOPMENT: UPLOAD LOCAL FILE TO BLOB ---
          setStatus("🧩 Uploading sample video (dev mode)...")
          const sampleResponse = await fetch("/video/sample.mp4")
          if (!sampleResponse.ok) throw new Error("Failed to fetch /video/sample.mp4");
          const videoFile = await sampleResponse.blob();

          // Upload the file to Vercel Blob using our new API route
          const blob = await upload("sample.mp4", videoFile, {
            access: 'public',
            handleUploadUrl: '/api/upload',
          });

          // Get the public URL from the response
          videoUrlToProcess = blob.url; 
          setStatus("✅ Sample video uploaded to Vercel Blob.");
        }
    
        // --- COMMON LOGIC (Audio and Chart) ---
        // These files are small, so Base64 is fine and avoids complexity.
        
        let chartImageBase64 = localStorage.getItem("chartImage")
        if (!chartImageBase64) throw new Error("Chart image not found in localStorage.")
    
        setStatus("🎵 Loading background audio...")
        const audioResponse = await fetch("/song/ipl_11.mp3")
        if (!audioResponse.ok) throw new Error(`Failed to load audio file.`);
        const audioBlob = await audioResponse.blob()
        const audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(audioBlob)
        })
    
        // --- SEND TO SERVER FOR PROCESSING ---
        // This request is now TINY! It just has a URL and two small Base64 strings.
        // This will NOT cause a 413 error.
        setStatus("🎞️ Processing video...")
        const processRes = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            type: "url", // We are *always* sending a URL for the video now
            videoUrl: videoUrlToProcess, 
            chartImageBase64, 
            audioBase64 
          }),
        })
    
        if (!processRes.ok) {
            const errData = await processRes.json();
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

    return () => {
        hasStartedGeneration.current = false;
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