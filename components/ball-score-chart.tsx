"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"
import { Card } from "@/components/ui/card"
import html2canvas from "html2canvas-pro" // 🔄 Import the new package
import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface BallScoreChartProps {
  matchData: {
    batting: {
      player: string
      runs: string
      balls: string
      fours: string
      sixes: string
      strike_rate: string
    }[]
  }
}

export default function BallScoreChart({ matchData }: BallScoreChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("")

  if (!matchData || !matchData.batting) {
    return <p className="text-orange-400">⚠️ No batting data available</p>
  }

  // 🔹 Filter valid batsmen
  const battingData = matchData.batting.filter((b: any) => b.player)

  // 🔹 Convert runs to numbers and compute cumulative totals
  const data = battingData.map((b) => {
    const cleanName = b.player.replace(/\(c\)|†/g, "").trim()
    const surname = cleanName.split(" ").slice(-1)[0]
    return {
      player: surname,
      runs: Number(b.runs) || 0,
      balls: Number(b.balls) || 0,
    }
  })

  const cumulativeData = data.map((b, index) => ({
    player: b.player,
    cumulativeScore: data.slice(0, index + 1).reduce((sum, p) => sum + (p.runs || 0), 0),
  }))

  // 📸 Capture function
  const captureChart = async () => {
    if (!chartRef.current) return
    setStatus("🖼️ Capturing chart... please wait.")
  
    await new Promise((resolve) => setTimeout(resolve, 500))
  
    try {
      // 🧩 STEP 1 — Skip the manual color replacement logic.
      // html2canvas-pro supports oklch() natively, making this redundant and unnecessary.
  
      // 🧩 STEP 2 — Capture chart as image
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#0f172a",
        scale: 2,
        useCORS: true,
        logging: false,
      })
  
      const imgData = canvas.toDataURL("image/png")
      localStorage.setItem("chartImage", imgData)
      setCapturedImage(imgData)
      setStatus("✅ Chart captured successfully!")
    } catch (err) {
      console.error("❌ Error capturing chart:", err)
      setStatus("⚠️ Capture failed. Please retry.")
    }
  }
  
  // 🧠 Automatically capture once when mounted
  useEffect(() => {
    captureChart()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">📊 Match Charts</h2>
        {/* <Button onClick={captureChart} className="bg-orange-500 hover:bg-orange-600">
          Capture Again
        </Button> */}
      </div>

      {/* <p className="text-sm text-gray-400">{status}</p> */}

      {/* Chart Section */}
      <div ref={chartRef} className="space-y-6">
        {/* Cumulative Score Chart */}
        <Card className="bg-slate-800 border-orange-500/30 p-6">
          <h3 className="text-white font-bold mb-4">🏏 Cumulative Team Score Progression</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,165,0,0.1)" />
              <XAxis
                dataKey="player"
                stroke="rgba(255,255,255,0.7)"
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis stroke="rgba(255,255,255,0.7)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(255, 165, 0, 0.3)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#fff" }}
              />
              <Line
                type="monotone"
                dataKey="cumulativeScore"
                stroke="#f97316"
                dot={{ r: 5 }}
                strokeWidth={2}
                name="Cumulative Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Runs Per Batsman Bar Chart */}
        <Card className="bg-slate-800 border-orange-500/30 p-6">
          <h3 className="text-white font-bold mb-4">🎯 Runs Scored by Each Batsman</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,165,0,0.1)" />
              <XAxis
                dataKey="player"
                stroke="rgba(255,255,255,0.7)"
                interval={0}
                tick={({ x, y, payload }) => {
                  const words = payload.value.split(" ")
                  return (
                    <text
                      x={x}
                      y={y + 10}
                      textAnchor="end"
                      fill="rgba(255,255,255,0.7)"
                      transform={`rotate(-20, ${x}, ${y})`}
                      style={{ fontSize: "12px" }}
                    >
                      {words.map((word: string, index: number) => (
                        <tspan key={index} x={x} dy={index === 0 ? 0 : 12}>
                          {word}
                        </tspan>
                      ))}
                    </text>
                  )
                }}
              />
              <YAxis stroke="rgba(255,255,255,0.7)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(255, 165, 0, 0.3)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="runs" fill="#f97316" name="Runs Scored" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 🖼️ Preview Captured Image */}
      {/* {capturedImage && (
        <div className="mt-6">
          <h3 className="text-white font-semibold mb-2">🖼️ Captured Chart Image:</h3>
          <img
            src={capturedImage}
            alt="Captured Chart"
            className="rounded-lg border border-orange-400/40 shadow-md w-full"
          />
        </div>
      )} */}
    </div>
  )
}
