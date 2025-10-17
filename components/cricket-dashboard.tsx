"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import BallScoreChart from "./ball-score-chart"
import CommentaryVideo from "./commentary-video"
import { GoogleGenAI } from "@google/genai"

interface CricketDashboardProps {
  avatar: string
  matchData: {
    season: number
    matchNumber: number
    inning: number
    over: number
    avatar: string
    voice: string
  }
}


export default function CricketDashboard({ avatar, matchData }: CricketDashboardProps) {
  const [activeTab, setActiveTab] = useState<"chart" | "video">("chart")
  const [commentaryScript, setCommentaryScript] = useState<string>("Generating commentary...")
  const [inningData, setInningData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const GeminiAPIKey = process.env.NEXT_PUBLIC_GOOGLE_GENAI_KEY
  console.log(matchData)
  useEffect(() => {
    async function fetchMatchData() {
      try {
        setLoading(true)
    
        // Step 1: Fetch JSON file from /public/data/
        const filePath = `/data/ipl_${matchData.season}.json`
        const res = await fetch(filePath)
        console.log("📂 Fetching file:", filePath)
        if (!res.ok) throw new Error("Failed to fetch JSON file")
        const json = await res.json()
    
        // Step 2: Get match by array index
        const matchIndex = matchData.matchNumber - 1
        const match = json[matchIndex]
        if (!match) {
          console.error("❌ Match not found in JSON")
          setCommentaryScript("❌ Match not found in data.")
          return
        }
    
        // Step 3: Extract inning
        const inning = match.innings?.[matchData.inning - 1]
        if (!inning) {
          console.error("❌ Inning not found.")
          setCommentaryScript("❌ Inning data not found.")
          return
        }
    
        setInningData(inning)

        const topBatsman = inning.batting.reduce((prev: any, curr: any) => {
          return curr.runs > prev.runs ? curr : prev
        }, inning.batting[0])
    
        // ✅ Step 4: Generate commentary using @google/genai (correct usage)
        const ai = new GoogleGenAI({ apiKey: GeminiAPIKey })
    
        const prompt = `
        You are a cricket commentator.
        Generate an exciting IPL commentary in 600 characters for:
        - Season: ${matchData.season}
        - Match: ${matchData.matchNumber}
        - Inning: ${matchData.inning}
        (strictly follow the word limit as video generation cannot exceed 25 sec.)

        Focus only on the top-scoring batsman:
        ${JSON.stringify(topBatsman, null, 2)}

        Style: Energetic, fun, and TV-style short sentences.
        `
    
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        })
    
        console.log("🎤 Commentary generated:", response)
        const aiText = (await response.text) || "⚠️ No commentary generated."
        setCommentaryScript(aiText)
      } catch (err) {
        console.error("Error:", err)
        setCommentaryScript("⚠️ Failed to fetch data or generate commentary.")
      } finally {
        setLoading(false)
      }
    }
    

    fetchMatchData()
  }, [matchData])

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-orange-400 mb-1">
            IPL {matchData.season} - Match {matchData.matchNumber}
          </h1>
          <p className="text-gray-400">Inning {matchData.inning}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("chart")}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              activeTab === "chart"
                ? "bg-orange-500 text-white"
                : "bg-slate-800 text-gray-300 hover:bg-slate-700"
            }`}
          >
            📊 Batsman vs Score Chart
          </button>
          <button
            onClick={() => setActiveTab("video")}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              activeTab === "video"
                ? "bg-orange-500 text-white"
                : "bg-slate-800 text-gray-300 hover:bg-slate-700"
            }`}
          >
            🎙️ AI Commentary
          </button>
        </div>

        {/* Main Content */}
        {loading ? (
          <p className="text-orange-400 animate-pulse">⏳ Loading match data...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {activeTab === "chart" ? (
                <BallScoreChart matchData={inningData} />
              ) : (
                <Card className="bg-slate-800 p-6 text-white">
                  <h3 className="font-bold mb-4 text-orange-400">AI Commentary</h3>
                  <p className="whitespace-pre-line">{commentaryScript}</p>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div>
              <CommentaryVideo avatar={avatar} voice={matchData.voice} commentary={commentaryScript} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
