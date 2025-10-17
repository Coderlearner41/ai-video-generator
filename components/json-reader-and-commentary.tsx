"use client"

import { useState } from "react"
import { GoogleGenerativeAI } from "@google/generative-ai"
import BattingChart from "./batting-chart"

export default function JsonReaderAndCommentary({
  setMatchData,
}: {
  setMatchData: (data: any) => void
}) {
  const [battingData, setBattingData] = useState<any[]>([])
  const [commentary, setCommentary] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const fileContent = e.target?.result as string
      const json = JSON.parse(fileContent)

      const match = json[0]
      const innings = match?.innings?.[0]
      const batting = innings?.batting || []

      setBattingData(batting)
      setMatchData({ batting })

      const prompt = `
        You're an IPL cricket commentator. Based on the batting performance below, 
        generate a short, energetic commentary summary with highlights of key players.

        Batting data:
        ${JSON.stringify(batting, null, 2)}
      `

      try {
        setLoading(true)
        const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_GENAI_KEY!)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        setCommentary(text)
      } catch (error) {
        console.error(error)
        setCommentary("❌ Failed to generate commentary. Check API key or file format.")
      } finally {
        setLoading(false)
      }
    }

    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="block bg-slate-800 border border-orange-400 rounded-md px-4 py-2"
      />

      {loading && (
        <p className="text-orange-400 animate-pulse">Generating AI commentary...</p>
      )}

      {battingData.length > 0 && <BattingChart batting={battingData} />}

      {commentary && (
        <div className="bg-slate-800 p-4 rounded-lg text-orange-400 whitespace-pre-line">
          <h3 className="font-bold mb-2">AI Commentary</h3>
          <p>{commentary}</p>
        </div>
      )}
    </div>
  )
}
