"use client"

import { useState } from "react"
import AvatarSelector from "@/components/avatar-selector"
import CricketDashboard from "@/components/cricket-dashboard"

export default function Home() {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [matchData, setMatchData] = useState<any>(null)

  const handleAvatarSelect = (avatar: string, data: any) => {
    setSelectedAvatar(avatar)
    setMatchData(data)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {!selectedAvatar ? (
        <AvatarSelector onSelect={handleAvatarSelect} />
      ) : (
        <CricketDashboard avatar={selectedAvatar} matchData={matchData} />
      )}
    </main>
  )
}
