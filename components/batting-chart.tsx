"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

export default function BattingChart({ batting }: { batting: any[] }) {
  const data = batting
    .filter((b) => b.player)
    .map((b) => ({
      name: b.player.replace("†", "").replace("(c)", ""),
      runs: Number(b.runs),
      balls: Number(b.balls),
    }))

  return (
    <div className="bg-slate-900 p-6 rounded-lg">
      <h3 className="text-xl text-orange-400 font-semibold mb-4">
        Batters Performance
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,165,0,0.2)" />
          <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
          <YAxis stroke="rgba(255,255,255,0.7)" />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(255,165,0,0.3)",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#fff" }}
          />
          <Bar dataKey="runs" fill="#f97316" name="Runs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
